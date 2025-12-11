import { GoogleGenAI } from "@google/genai";
import { Product, Transaction, TransactionType, AIAnalysisResult } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key not found in environment variables");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const GeminiService = {
  analyzeBusiness: async (products: Product[], transactions: Transaction[]): Promise<AIAnalysisResult> => {
    const ai = getClient();
    if (!ai) return { summary: "无法连接AI服务 (缺少API Key)", suggestions: [] };

    // Prepare data context summary to reduce token usage
    const lowStockItems = products.filter(p => p.stock <= p.minStockLevel).map(p => `${p.name}(剩余${p.stock})`);
    const recentSales = transactions
      .filter(t => t.type === TransactionType.SALE)
      .slice(0, 10)
      .map(t => `${t.productName} x${t.quantity}`);

    const prompt = `
      作为一名专业的商业供应链分析师，请根据以下数据生成一份简短的中文分析报告（JSON格式）。
      
      当前库存状况:
      - 总产品数: ${products.length}
      - 缺货/低库存预警产品: ${lowStockItems.join(', ') || '无'}
      
      最近销售记录 (前10笔):
      ${recentSales.join('; ')}

      请返回如下JSON格式 (不要使用Markdown代码块，直接返回纯JSON文本):
      {
        "summary": "一句话概括当前业务健康状况",
        "suggestions": ["建议1", "建议2", "建议3"]
      }
      建议应侧重于进货建议、促销建议或库存风险提示。
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const text = response.text || "{}";
      return JSON.parse(text) as AIAnalysisResult;
    } catch (error) {
      console.error("Gemini Analysis Error:", error);
      return {
        summary: "分析服务暂时不可用。",
        suggestions: ["请检查网络连接", "请确认API Key配置正确"]
      };
    }
  },

  chat: async (message: string, contextData: string) => {
    const ai = getClient();
    if (!ai) return "AI服务未配置。";

    const systemInstruction = `
      你是一个智能库存管理助手。你的名字叫“贵蓁助手”。
      你的任务是帮助用户查询库存、分析销售数据或提供运营建议。
      请用中文回答，语气专业且友善。
      
      当前系统数据上下文:
      ${contextData}
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: message,
        config: {
          systemInstruction: systemInstruction,
        }
      });
      return response.text || "抱歉，我没有理解您的问题。";
    } catch (error) {
      console.error("Chat Error:", error);
      return "抱歉，发生了一个错误，请稍后再试。";
    }
  }
};