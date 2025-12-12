import { Product, Transaction, TransactionType, Customer, FinanceRecord, ProductType, CustomerCard } from '../types';

const KEYS = {
  PRODUCTS: 'ssi_products',
  TRANSACTIONS: 'ssi_transactions',
  CUSTOMERS: 'ssi_customers',
  FINANCE: 'ssi_finance',
};

// Initial Mock Data
const INITIAL_PRODUCTS: Product[] = [
  { id: '1', name: '高级人体工学椅', category: '办公家具', sku: 'FURN-001', price: 1299, cost: 600, stock: 15, minStockLevel: 5, type: ProductType.GOODS },
  { id: '2', name: '10次保养卡', category: '服务', sku: 'SRV-001', price: 500, cost: 0, stock: 999, minStockLevel: 0, type: ProductType.SERVICE_COUNT, value: 10 },
  { id: '3', name: '年度会员卡', category: '服务', sku: 'SRV-002', price: 1200, cost: 0, stock: 999, minStockLevel: 0, type: ProductType.SERVICE_TIME, value: 365 },
];

const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'c1', name: '张三', phone: '13800138000', notes: '老客户', cards: [], lastActivity: new Date().toISOString() },
  { id: 'c2', name: '李四', phone: '13900139000', notes: '', cards: [] },
];

const initData = () => {
  if (!localStorage.getItem(KEYS.PRODUCTS)) localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
  if (!localStorage.getItem(KEYS.CUSTOMERS)) localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(INITIAL_CUSTOMERS));
};

initData();

export const StorageService = {
  // Products
  getProducts: (): Product[] => {
    return JSON.parse(localStorage.getItem(KEYS.PRODUCTS) || '[]');
  },
  saveProduct: (product: Product): void => {
    const products = StorageService.getProducts();
    const index = products.findIndex(p => p.id === product.id);
    if (index >= 0) products[index] = product;
    else products.push(product);
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  },
  batchSaveProducts: (newProducts: Product[]): void => {
    const products = StorageService.getProducts();
    // Merge new products, overwrite if ID exists (though import usually creates new IDs)
    newProducts.forEach(np => {
        const index = products.findIndex(p => p.id === np.id);
        if (index >= 0) products[index] = np;
        else products.push(np);
    });
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  },
  deleteProduct: (id: string): void => {
     const products = StorageService.getProducts().filter(p => p.id !== id);
     localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  },

  // Customers
  getCustomers: (): Customer[] => {
    return JSON.parse(localStorage.getItem(KEYS.CUSTOMERS) || '[]');
  },
  saveCustomer: (customer: Customer): void => {
    const customers = StorageService.getCustomers();
    const index = customers.findIndex(c => c.id === customer.id);
    if (index >= 0) customers[index] = customer;
    else customers.push(customer);
    localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(customers));
  },
  batchSaveCustomers: (newCustomers: Customer[]): void => {
    const customers = StorageService.getCustomers();
    newCustomers.forEach(nc => customers.push(nc));
    localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(customers));
  },
  deleteCustomer: (id: string): void => {
    const customers = StorageService.getCustomers().filter(c => c.id !== id);
    localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(customers));
  },

  // Customer Card Logic (Issuing)
  issueCardToCustomer: (customerId: string, product: Product, quantity: number) => {
    const customers = StorageService.getCustomers();
    const customerIndex = customers.findIndex(c => c.id === customerId);
    if (customerIndex === -1) return;

    const customer = customers[customerIndex];
    
    // Update Activity
    customer.lastActivity = new Date().toISOString();

    // Create cards based on quantity purchased
    for(let i=0; i<quantity; i++) {
        const newCard: CustomerCard = {
            id: Date.now().toString() + Math.random().toString().slice(2,6),
            productId: product.id,
            productName: product.name,
            type: product.type,
            purchaseDate: new Date().toISOString(),
        };

        if (product.type === ProductType.SERVICE_COUNT) {
            newCard.remainingCounts = product.value || 1; // Default 1 if not set
        } else if (product.type === ProductType.SERVICE_TIME) {
            const days = product.value || 30;
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + days);
            newCard.expiryDate = expiry.toISOString();
        }
        customer.cards.push(newCard);
    }
    
    customers[customerIndex] = customer;
    localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(customers));
  },

  // Customer Card Logic (Redemption/Verifying)
  redeemCard: (customerId: string, cardId: string, quantity: number = 1): boolean => {
      const customers = StorageService.getCustomers();
      const cIndex = customers.findIndex(c => c.id === customerId);
      if (cIndex === -1) return false;

      const customer = customers[cIndex];
      const cardIndex = customer.cards.findIndex(card => card.id === cardId);
      if (cardIndex === -1) return false;

      const card = customer.cards[cardIndex];

      // Update Activity
      customer.lastActivity = new Date().toISOString();

      if (card.type === ProductType.SERVICE_TIME) {
          // Time cards just need to check expiry
          if (new Date(card.expiryDate!) < new Date()) return false; // Expired
          
          // Even if not deducting counts, we updated the customer activity above
          customers[cIndex] = customer;
          localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(customers));
          return true;
      } else if (card.type === ProductType.SERVICE_COUNT) {
          if ((card.remainingCounts || 0) < quantity) return false;
          card.remainingCounts = (card.remainingCounts || 0) - quantity;
          
          customer.cards[cardIndex] = card;
          customers[cIndex] = customer;
          localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(customers));
          return true;
      }
      return false;
  },

  // Transactions
  getTransactions: (): Transaction[] => {
    return JSON.parse(localStorage.getItem(KEYS.TRANSACTIONS) || '[]');
  },
  addTransaction: (transaction: Transaction): void => {
    const transactions = StorageService.getTransactions();
    transactions.unshift(transaction);
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions));

    // Update Product Stock
    if (transaction.productId) {
        const products = StorageService.getProducts();
        const pIndex = products.findIndex(p => p.id === transaction.productId);
        if (pIndex >= 0) {
            const product = products[pIndex];
            // Only update stock for GOODS, or if you want to track card inventory (usually infinite)
            if (product.type === ProductType.GOODS) {
                 if (transaction.type === TransactionType.PURCHASE) product.stock += (transaction.quantity || 0);
                 else product.stock -= (transaction.quantity || 0);
                 StorageService.saveProduct(product);
            }
        }
    }

    // Issue Card if it's a SERVICE SALE and has a customer
    if (transaction.type === TransactionType.SALE && transaction.productId && transaction.partyId) {
        const products = StorageService.getProducts();
        const product = products.find(p => p.id === transaction.productId);
        if (product && (product.type === ProductType.SERVICE_COUNT || product.type === ProductType.SERVICE_TIME)) {
            StorageService.issueCardToCustomer(transaction.partyId, product, transaction.quantity || 1);
        }
    }
  },
  batchAddTransactions: (newTransactions: Transaction[]): void => {
      const transactions = StorageService.getTransactions();
      const products = StorageService.getProducts();
      
      // Add all new transactions
      newTransactions.forEach(t => transactions.unshift(t));
      
      // Update stock for all involved products
      newTransactions.forEach(t => {
          if (t.productId) {
              const pIndex = products.findIndex(p => p.id === t.productId);
              if (pIndex >= 0) {
                  const product = products[pIndex];
                  if (product.type === ProductType.GOODS) {
                     if (t.type === TransactionType.PURCHASE) product.stock += (t.quantity || 0);
                     else product.stock -= (t.quantity || 0);
                  }
              }
          }
      });
      
      localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions));
      localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  },

  // Finance
  getFinanceRecords: (): FinanceRecord[] => {
    return JSON.parse(localStorage.getItem(KEYS.FINANCE) || '[]');
  },
  addFinanceRecord: (record: FinanceRecord): void => {
      const records = StorageService.getFinanceRecords();
      records.unshift(record);
      localStorage.setItem(KEYS.FINANCE, JSON.stringify(records));
  },
  batchAddFinanceRecords: (newRecords: FinanceRecord[]): void => {
      const records = StorageService.getFinanceRecords();
      newRecords.forEach(r => records.unshift(r));
      localStorage.setItem(KEYS.FINANCE, JSON.stringify(records));
  },
  deleteFinanceRecord: (id: string): void => {
      const records = StorageService.getFinanceRecords().filter(r => r.id !== id);
      localStorage.setItem(KEYS.FINANCE, JSON.stringify(records));
  },

  // Backup & Restore
  getAllData: () => {
    return {
      products: StorageService.getProducts(),
      transactions: StorageService.getTransactions(),
      customers: StorageService.getCustomers(),
      finance: StorageService.getFinanceRecords(),
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
  },
  restoreData: (data: any): boolean => {
    try {
      if (data.products) localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(data.products));
      if (data.transactions) localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(data.transactions));
      if (data.customers) localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(data.customers));
      if (data.finance) localStorage.setItem(KEYS.FINANCE, JSON.stringify(data.finance));
      return true;
    } catch (e) {
      console.error("Restore failed", e);
      return false;
    }
  }
};