import { getStore } from "@netlify/blobs";
import type { Context } from "@netlify/functions";

// 有效的数据存储名称
const VALID_STORES = ["products", "customers", "transactions", "finance"] as const;
type StoreName = (typeof VALID_STORES)[number];

// 版本标记 key
const VERSION_KEY = "_version";

/**
 * 获取当前数据版本号（时间戳），用于客户端轮询判断是否有新数据
 */
async function getVersion(store: ReturnType<typeof getStore>): Promise<string> {
  const version = await store.get(VERSION_KEY);
  return version || "0";
}

/**
 * 递增版本号（使用当前时间戳）
 */
async function bumpVersion(store: ReturnType<typeof getStore>): Promise<string> {
  const newVersion = Date.now().toString();
  await store.set(VERSION_KEY, newVersion);
  return newVersion;
}

/**
 * 从 Blob 获取数据数组
 */
async function getData(store: ReturnType<typeof getStore>, key: string): Promise<any[]> {
  const raw = await store.get(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * 将数据数组保存到 Blob
 */
async function setData(store: ReturnType<typeof getStore>, key: string, data: any[]): Promise<void> {
  await store.set(key, JSON.stringify(data));
}

/**
 * 构建标准 JSON 响应
 */
function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

/**
 * 构建错误响应
 */
function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

/**
 * Netlify Function v2 入口
 * 
 * 路由说明：
 * GET    ?action=version                  → 获取数据版本号
 * GET    ?store=products                  → 获取全部商品
 * PUT    ?store=products                  → 保存（全量覆盖）商品数组
 * PUT    ?store=products&mode=upsert      → 按 ID 合并商品数组
 * DELETE ?store=products&id=xxx           → 删除指定 ID 的商品
 * DELETE ?store=products&id=xxx,yyy       → 批量删除
 */
export default async (request: Request, _context: Context): Promise<Response> => {
  // 处理 CORS 预检请求
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const storeName = url.searchParams.get("store") as StoreName | null;

  // 获取 Netlify Blobs store（使用 strong consistency 保证写后立即可读）
  const blobStore = getStore({ name: "crm-data", consistency: "strong" });

  // === 版本号查询（用于轮询） ===
  if (action === "version") {
    const version = await getVersion(blobStore);
    return jsonResponse({ version });
  }

  // === 数据 CRUD 操作 ===
  if (!storeName || !VALID_STORES.includes(storeName)) {
    return errorResponse(`无效的 store 参数，有效值: ${VALID_STORES.join(", ")}`);
  }

  try {
    switch (request.method) {
      // === GET：获取全部数据 ===
      case "GET": {
        const data = await getData(blobStore, storeName);
        return jsonResponse(data);
      }

      // === PUT：保存数据 ===
      case "PUT": {
        const body = await request.json();
        const mode = url.searchParams.get("mode");

        if (!Array.isArray(body)) {
          return errorResponse("请求体必须是数组");
        }

        if (mode === "upsert") {
          // 合并模式：按 ID 更新已有记录，插入新记录
          const existing = await getData(blobStore, storeName);
          const existingMap = new Map(existing.map((item: any) => [item.id, item]));

          for (const item of body) {
            existingMap.set(item.id, item);
          }

          await setData(blobStore, storeName, Array.from(existingMap.values()));
        } else {
          // 默认：全量覆盖
          await setData(blobStore, storeName, body);
        }

        await bumpVersion(blobStore);
        return jsonResponse({ success: true });
      }

      // === DELETE：删除指定记录 ===
      case "DELETE": {
        const idParam = url.searchParams.get("id");
        if (!idParam) {
          return errorResponse("DELETE 操作需要 id 参数");
        }

        const idsToDelete = new Set(idParam.split(","));
        const existing = await getData(blobStore, storeName);
        const filtered = existing.filter((item: any) => !idsToDelete.has(item.id));

        await setData(blobStore, storeName, filtered);
        await bumpVersion(blobStore);
        return jsonResponse({ success: true, deleted: idsToDelete.size });
      }

      default:
        return errorResponse(`不支持的 HTTP 方法: ${request.method}`, 405);
    }
  } catch (err: any) {
    console.error(`同步操作失败 [${request.method} ${storeName}]:`, err);
    return errorResponse(`服务器内部错误: ${err.message}`, 500);
  }
};
