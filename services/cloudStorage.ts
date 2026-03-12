import { Product, Transaction, Customer, FinanceRecord, ProductType } from '../types';

// Netlify Function 的 API 端点（开发环境和生产环境均通过相对路径访问）
const API_BASE = '/.netlify/functions/sync';

/**
 * 通用 API 请求方法
 */
async function apiRequest<T = any>(
  method: 'GET' | 'PUT' | 'DELETE',
  params: Record<string, string>,
  body?: any
): Promise<T> {
  const url = new URL(API_BASE, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body !== undefined && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: '未知错误' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * 云存储服务 - 基于 Netlify Functions + Blobs
 */
export const CloudStorageService = {
  // === 商品 ===
  getProducts: async (): Promise<Product[]> => {
    try {
      return await apiRequest<Product[]>('GET', { store: 'products' });
    } catch (error) {
      console.error('获取商品失败:', error);
      return [];
    }
  },

  saveProduct: async (product: Product): Promise<void> => {
    try {
      await apiRequest('PUT', { store: 'products', mode: 'upsert' }, [product]);
    } catch (error) {
      console.error('保存商品失败:', error);
    }
  },

  deleteProduct: async (id: string): Promise<void> => {
    try {
      await apiRequest('DELETE', { store: 'products', id });
    } catch (error) {
      console.error('删除商品失败:', error);
    }
  },

  batchSaveProducts: async (newProducts: Product[]): Promise<void> => {
    try {
      await apiRequest('PUT', { store: 'products', mode: 'upsert' }, newProducts);
    } catch (error) {
      console.error('批量保存商品失败:', error);
    }
  },

  // === 客户 ===
  getCustomers: async (): Promise<Customer[]> => {
    try {
      return await apiRequest<Customer[]>('GET', { store: 'customers' });
    } catch (error) {
      console.error('获取客户失败:', error);
      return [];
    }
  },

  saveCustomer: async (customer: Customer): Promise<void> => {
    try {
      await apiRequest('PUT', { store: 'customers', mode: 'upsert' }, [customer]);
    } catch (error) {
      console.error('保存客户失败:', error);
    }
  },

  batchSaveCustomers: async (newCustomers: Customer[]): Promise<void> => {
    try {
      await apiRequest('PUT', { store: 'customers', mode: 'upsert' }, newCustomers);
    } catch (error) {
      console.error('批量保存客户失败:', error);
    }
  },

  deleteCustomer: async (id: string): Promise<void> => {
    try {
      // 同时删除客户和其关联的卡片（在 Blob 存储中客户数据包含 cards）
      await apiRequest('DELETE', { store: 'customers', id });
    } catch (error) {
      console.error('删除客户失败:', error);
    }
  },

  // 客户卡片发放
  issueCardToCustomer: async (customerId: string, product: Product, quantity: number): Promise<void> => {
    try {
      // 1. 获取当前客户列表
      const customers = await CloudStorageService.getCustomers();
      const customer = customers.find(c => c.id === customerId);
      if (!customer) return;

      // 2. 更新活动时间
      customer.lastActivity = new Date().toISOString();

      // 3. 创建新卡片
      for (let i = 0; i < quantity; i++) {
        const newCard: any = {
          id: Date.now().toString() + Math.random().toString().slice(2, 6),
          productId: product.id,
          productName: product.name,
          type: product.type,
          purchaseDate: new Date().toISOString(),
        };

        if (product.type === ProductType.SERVICE_COUNT) {
          newCard.remainingCounts = product.value || 1;
        } else if (product.type === ProductType.SERVICE_TIME) {
          const days = product.value || 30;
          const expiry = new Date();
          expiry.setDate(expiry.getDate() + days);
          newCard.expiryDate = expiry.toISOString();
        }

        customer.cards.push(newCard);
      }

      // 4. 保存更新后的客户
      await CloudStorageService.saveCustomer(customer);
    } catch (error) {
      console.error('发放卡片失败:', error);
    }
  },

  // 客户卡片核销
  redeemCard: async (customerId: string, cardId: string, quantity: number = 1): Promise<boolean> => {
    try {
      const customers = await CloudStorageService.getCustomers();
      const customer = customers.find(c => c.id === customerId);
      if (!customer) return false;

      const card = customer.cards.find(c => c.id === cardId);
      if (!card) return false;

      // 更新活动时间
      customer.lastActivity = new Date().toISOString();

      if (card.type === ProductType.SERVICE_TIME) {
        if (new Date(card.expiryDate!) < new Date()) return false;
        await CloudStorageService.saveCustomer(customer);
        return true;
      } else if (card.type === ProductType.SERVICE_COUNT) {
        const remaining = card.remainingCounts || 0;
        if (remaining < quantity) return false;
        card.remainingCounts = remaining - quantity;
        await CloudStorageService.saveCustomer(customer);
        return true;
      }

      return false;
    } catch (error) {
      console.error('核销卡片失败:', error);
      return false;
    }
  },

  // === 交易 ===
  getTransactions: async (): Promise<Transaction[]> => {
    try {
      return await apiRequest<Transaction[]>('GET', { store: 'transactions' });
    } catch (error) {
      console.error('获取交易记录失败:', error);
      return [];
    }
  },

  addTransaction: async (transaction: Transaction): Promise<void> => {
    try {
      // 1. 添加交易记录
      const transactions = await CloudStorageService.getTransactions();
      transactions.unshift(transaction);
      await apiRequest('PUT', { store: 'transactions' }, transactions);

      // 2. 更新库存
      if (transaction.productId) {
        const products = await CloudStorageService.getProducts();
        const product = products.find(p => p.id === transaction.productId);
        if (product && product.type === ProductType.GOODS) {
          const stockChange = transaction.type === 'PURCHASE'
            ? (transaction.quantity || 0)
            : -(transaction.quantity || 0);
          product.stock += stockChange;
          await CloudStorageService.saveProduct(product);
        }

        // 3. 如果是服务销售，发放卡片
        if (
          transaction.type === 'SALE' &&
          transaction.partyId &&
          product &&
          (product.type === ProductType.SERVICE_COUNT || product.type === ProductType.SERVICE_TIME)
        ) {
          await CloudStorageService.issueCardToCustomer(
            transaction.partyId,
            product,
            transaction.quantity || 1
          );
        }
      }
    } catch (error) {
      console.error('添加交易失败:', error);
    }
  },

  batchAddTransactions: async (newTransactions: Transaction[]): Promise<void> => {
    try {
      // 1. 添加交易记录
      const existing = await CloudStorageService.getTransactions();
      const all = [...newTransactions, ...existing];
      await apiRequest('PUT', { store: 'transactions' }, all);

      // 2. 批量更新库存
      const products = await CloudStorageService.getProducts();
      const productMap = new Map(products.map(p => [p.id, p]));

      for (const t of newTransactions) {
        if (t.productId) {
          const product = productMap.get(t.productId);
          if (product && product.type === ProductType.GOODS) {
            const stockChange = t.type === 'PURCHASE' ? (t.quantity || 0) : -(t.quantity || 0);
            product.stock += stockChange;
          }
        }
      }

      await apiRequest('PUT', { store: 'products' }, Array.from(productMap.values()));
    } catch (error) {
      console.error('批量添加交易失败:', error);
    }
  },

  // === 财务 ===
  getFinanceRecords: async (): Promise<FinanceRecord[]> => {
    try {
      return await apiRequest<FinanceRecord[]>('GET', { store: 'finance' });
    } catch (error) {
      console.error('获取财务记录失败:', error);
      return [];
    }
  },

  addFinanceRecord: async (record: FinanceRecord): Promise<void> => {
    try {
      const records = await CloudStorageService.getFinanceRecords();
      records.unshift(record);
      await apiRequest('PUT', { store: 'finance' }, records);
    } catch (error) {
      console.error('添加财务记录失败:', error);
    }
  },

  deleteFinanceRecord: async (id: string): Promise<void> => {
    try {
      await apiRequest('DELETE', { store: 'finance', id });
    } catch (error) {
      console.error('删除财务记录失败:', error);
    }
  },

  batchAddFinanceRecords: async (newRecords: FinanceRecord[]): Promise<void> => {
    try {
      const existing = await CloudStorageService.getFinanceRecords();
      const all = [...newRecords, ...existing];
      await apiRequest('PUT', { store: 'finance' }, all);
    } catch (error) {
      console.error('批量添加财务记录失败:', error);
    }
  },

  // === 轮询同步 ===
  /**
   * 启动轮询，定期检查版本号变化
   * @param onDataChange 数据变化时的回调函数
   * @param intervalMs 轮询间隔（毫秒），默认 5000
   * @returns 停止轮询的函数
   */
  startPolling: (onDataChange: () => void, intervalMs = 5000): (() => void) => {
    let lastVersion = '0';
    let isRunning = true;

    const poll = async () => {
      if (!isRunning) return;

      try {
        const { version } = await apiRequest<{ version: string }>('GET', { action: 'version' });
        if (version !== lastVersion && lastVersion !== '0') {
          // 版本号变化，触发数据刷新
          onDataChange();
        }
        lastVersion = version;
      } catch (error) {
        // 轮询失败不中断，静默忽略
        console.warn('轮询版本号失败:', error);
      }

      if (isRunning) {
        setTimeout(poll, intervalMs);
      }
    };

    // 首次轮询延迟一小段时间启动
    setTimeout(poll, 1000);

    // 返回停止函数
    return () => {
      isRunning = false;
    };
  },
};
