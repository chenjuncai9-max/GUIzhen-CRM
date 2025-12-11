import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Orders from './components/Orders';
import Customers from './components/Customers';
import Finance from './components/Finance';
import Settings from './components/Settings';
import { StorageService } from './services/storage';
import { Product, Transaction, TransactionType, Customer, FinanceRecord } from './types';
import { Bell, User, LayoutDashboard, Package, TrendingUp, ShoppingCart, Sparkles, Users, Wallet } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [financeRecords, setFinanceRecords] = useState<FinanceRecord[]>([]);

  // Load initial data
  useEffect(() => {
    refreshAllData();
  }, []);

  const refreshAllData = () => {
      setProducts(StorageService.getProducts());
      setTransactions(StorageService.getTransactions());
      setCustomers(StorageService.getCustomers());
      setFinanceRecords(StorageService.getFinanceRecords());
  };

  // Handlers to update state and local storage
  const handleAddProduct = (product: Product) => {
    StorageService.saveProduct(product);
    refreshAllData();
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('确定要删除这个商品吗？')) {
      StorageService.deleteProduct(id);
      refreshAllData();
    }
  };

  const handleOrder = (transaction: Transaction) => {
    StorageService.addTransaction(transaction);
    refreshAllData();
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard products={products} transactions={transactions} onNavigate={setActiveTab} />;
      case 'inventory':
        return <Inventory products={products} onAddProduct={handleAddProduct} onDeleteProduct={handleDeleteProduct} />;
      case 'sales':
        return <Orders type={TransactionType.SALE} products={products} transactions={transactions} customers={customers} onSubmitOrder={handleOrder} />;
      case 'purchase':
        return <Orders type={TransactionType.PURCHASE} products={products} transactions={transactions} customers={customers} onSubmitOrder={handleOrder} />;
      case 'customers':
        return <Customers customers={customers} onUpdate={refreshAllData} />;
      case 'finance':
        return <Finance financeRecords={financeRecords} transactions={transactions} onUpdate={refreshAllData} />;
      case 'settings':
        return <Settings onDataRestored={refreshAllData} />;
      default:
        return <Dashboard products={products} transactions={transactions} onNavigate={setActiveTab} />;
    }
  };

  const navItems = [
    { id: 'dashboard', label: '总览', icon: LayoutDashboard },
    { id: 'sales', label: '交易', icon: TrendingUp },
    { id: 'customers', label: '客户', icon: Users },
    { id: 'finance', label: '财务', icon: Wallet },
    { id: 'inventory', label: '库存', icon: Package },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Sidebar for Desktop */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Top Header */}
        <header className="h-14 md:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shadow-sm z-10 shrink-0">
           <div className="flex items-center space-x-2 md:hidden">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                <Sparkles size={18} className="text-white" />
              </div>
              <h1 className="text-lg font-bold text-slate-800 tracking-wide">贵蓁供销存</h1>
           </div>

           <div className="hidden md:block text-slate-400 text-sm font-medium">
             {new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
           </div>
           
           <div className="flex items-center space-x-4 md:space-x-6">
              <button className="relative text-slate-500 hover:text-indigo-600 transition-colors">
                <Bell size={20} />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
              </button>
              <div 
                className="flex items-center space-x-2 md:space-x-3 pl-4 md:pl-6 border-l border-slate-100 cursor-pointer group"
                onClick={() => setActiveTab('settings')}
                title="系统设置"
              >
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${activeTab === 'settings' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500 group-hover:bg-slate-300'}`}>
                    <User size={18} />
                 </div>
                 <span className="hidden md:inline text-sm font-medium text-slate-700">管理员</span>
              </div>
           </div>
        </header>

        {/* Dynamic Content */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8 scroll-smooth bg-slate-50/50">
          <div className="max-w-7xl mx-auto">
             {renderContent()}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center px-2 py-2 pb-safe shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)] z-50">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center w-full py-1 space-y-1 transition-colors duration-200 ${
                activeTab === item.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <item.icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;