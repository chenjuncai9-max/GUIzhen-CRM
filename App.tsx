import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Orders from './components/Orders';
import AIAssistant from './components/AIAssistant';
import Customers from './components/Customers';
import Finance from './components/Finance';
import Settings from './components/Settings';
import LoginPage from './components/LoginPage';
import { CloudStorageService } from './services/cloudStorage';
import { Product, Transaction, TransactionType, Customer, FinanceRecord } from './types';
import { Bell, User, LayoutDashboard, Package, TrendingUp, ShoppingCart, Sparkles, Users, Wallet, Cloud, CloudOff, RefreshCw, AlertCircle, CheckCircle2, LogOut } from 'lucide-react';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('authenticated') === 'true';
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [financeRecords, setFinanceRecords] = useState<FinanceRecord[]>([]);

  // State for handling inventory filtering from dashboard
  const [inventoryFilter, setInventoryFilter] = useState<'ALL' | 'LOW_STOCK'>('ALL');

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');

  // Load initial data and setup subscription
  useEffect(() => {
    refreshAllData();

    // Setup Realtime Subscription
    const subscription = CloudStorageService.subscribeToChanges(() => {
      // When cloud data changes (from other clients or self), refresh local state
      refreshAllData(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshAllData = async (isBackgroundSync = false) => {
    if (!isBackgroundSync) setSyncStatus('syncing');
    try {
      const [fetchedProducts, fetchedTransactions, fetchedCustomers, fetchedFinance] = await Promise.all([
        CloudStorageService.getProducts(),
        CloudStorageService.getTransactions(),
        CloudStorageService.getCustomers(),
        CloudStorageService.getFinanceRecords()
      ]);
      setProducts(fetchedProducts);
      setTransactions(fetchedTransactions);
      setCustomers(fetchedCustomers);
      setFinanceRecords(fetchedFinance);
      setSyncStatus('idle');
    } catch (e) {
      console.error('Initial data fetch failed', e);
      setSyncStatus('error');
    }
  };

  // Handlers to update state and cloud storage
  const handleAddProduct = async (product: Product) => {
    setSyncStatus('syncing');
    await CloudStorageService.saveProduct(product);
    await refreshAllData();
  };

  // Optimized for Bulk Import
  const handleBatchAddProduct = async (newProducts: Product[]) => {
    setSyncStatus('syncing');
    await CloudStorageService.batchSaveProducts(newProducts);
    await refreshAllData();
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('确定要删除这个商品吗？')) {
      setSyncStatus('syncing');
      await CloudStorageService.deleteProduct(id);
      await refreshAllData();
    }
  };

  const handleOrder = async (transaction: Transaction) => {
    setSyncStatus('syncing');
    await CloudStorageService.addTransaction(transaction);
    await refreshAllData();
  };

  // Optimized for Bulk Import
  const handleBatchAddTransaction = async (newTransactions: Transaction[]) => {
    setSyncStatus('syncing');
    await CloudStorageService.batchAddTransactions(newTransactions);
    await refreshAllData();
  };

  const handleNavigate = (tab: string, params?: any) => {
    setActiveTab(tab);
    if (tab === 'inventory') {
      if (params?.filter) setInventoryFilter(params.filter);
      else setInventoryFilter('ALL');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard products={products} transactions={transactions} onNavigate={handleNavigate} />;
      case 'inventory':
        return <Inventory
          products={products}
          onAddProduct={handleAddProduct}
          onBatchAddProduct={handleBatchAddProduct}
          onDeleteProduct={handleDeleteProduct}
          initialFilter={inventoryFilter}
        />;
      case 'sales':
        return <Orders
          type={TransactionType.SALE}
          products={products}
          transactions={transactions}
          customers={customers}
          onSubmitOrder={handleOrder}
          onBatchSubmitOrder={handleBatchAddTransaction}
        />;
      case 'purchase':
        return <Orders
          type={TransactionType.PURCHASE}
          products={products}
          transactions={transactions}
          customers={customers}
          onSubmitOrder={handleOrder}
          onBatchSubmitOrder={handleBatchAddTransaction}
        />;
      case 'customers':
        return <Customers customers={customers} transactions={transactions} onUpdate={refreshAllData} />;
      case 'finance':
        return <Finance financeRecords={financeRecords} transactions={transactions} onUpdate={refreshAllData} />;
      case 'ai-insight':
        return <AIAssistant products={products} transactions={transactions} />;
      case 'settings':
        return <Settings onDataRestored={refreshAllData} />;
      default:
        return <Dashboard products={products} transactions={transactions} onNavigate={handleNavigate} />;
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('authenticated');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

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
      <Sidebar activeTab={activeTab} onTabChange={(tab) => handleNavigate(tab)} />

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
            {/* Cloud Sync Status Indicator */}
            <div className="flex items-center space-x-1" title={
              syncStatus === 'syncing' ? '正在同步数据...' :
                syncStatus === 'error' ? '云端断开连接或发生错误' :
                  '已与云端保持实时同步'
            }>
              {syncStatus === 'idle' && <Cloud size={20} className="text-emerald-500" />}
              {syncStatus === 'syncing' && <RefreshCw size={20} className="text-indigo-500 animate-spin" />}
              {syncStatus === 'error' && <CloudOff size={20} className="text-red-500" />}
              <span className="hidden md:inline text-xs mt-0.5 font-medium text-slate-500">
                {syncStatus === 'idle' && '实时同步中'}
                {syncStatus === 'syncing' && '同步中'}
                {syncStatus === 'error' && '同步失败'}
              </span>
            </div>

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
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-500 transition-colors"
              title="退出登录"
            >
              <LogOut size={20} />
            </button>
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
              onClick={() => handleNavigate(item.id)}
              className={`flex flex-col items-center justify-center w-full py-1 space-y-1 transition-colors duration-200 ${activeTab === item.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
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