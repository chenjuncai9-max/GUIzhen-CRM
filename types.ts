export enum TransactionType {
  PURCHASE = 'PURCHASE', // 进货
  SALE = 'SALE',         // 销售
  EXPENSE = 'EXPENSE',   // 支出 (财务)
  INCOME = 'INCOME'      // 其他收入 (财务)
}

export enum ProductType {
  GOODS = 'GOODS',             // 普通实物商品
  SERVICE_COUNT = 'SERVICE_COUNT', // 次卡 (按次核销)
  SERVICE_TIME = 'SERVICE_TIME'    // 期限卡 (月卡/年卡)
}

export interface Product {
  id: string;
  name: string;
  category: string;
  sku: string;
  price: number; 
  cost: number;
  stock: number; // 对于服务类商品，库存可以是虚拟的或-1代表无限
  minStockLevel: number;
  type: ProductType;
  value?: number; // 次卡的次数 (如10次) 或 期限卡的天数 (如30天)
}

export interface CustomerCard {
  id: string;
  productId: string;
  productName: string;
  type: ProductType;
  remainingCounts?: number; // 仅次卡
  expiryDate?: string;      // 仅期限卡
  purchaseDate: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  cards: CustomerCard[]; // 客户持有的资产
  lastActivity?: string; // 最后活动时间 (开卡或核销)
}

export interface Transaction {
  id: string;
  date: string; 
  type: TransactionType;
  productId?: string; // 财务记录可能没有关联商品
  productName?: string;
  quantity?: number;
  totalAmount: number;
  partyName: string; // 供应商 或 客户名称
  partyId?: string;  // 关联的客户ID
  costSnapshot?: number; // 记录销售时的成本，用于计算毛利
}

export interface FinanceRecord {
  id: string;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: string; // 房租, 人工, 水电, 销售收入(自动), 采购支出(自动)
  description?: string;
}

export interface AIAnalysisResult {
  summary: string;
  suggestions: string[];
}