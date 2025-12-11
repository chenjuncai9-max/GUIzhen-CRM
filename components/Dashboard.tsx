import React, { useMemo } from 'react';
import { Product, Transaction, TransactionType } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, AlertTriangle, Package, DollarSign } from 'lucide-react';

interface DashboardProps {
  products: Product[];
  transactions: Transaction[];
  onNavigate: (tab: string) => void;
}

const StatCard = ({ title, value, subtext, icon: Icon, colorClass }: any) => (
  <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
    <div>
      <p className="text-slate-500 text-xs md:text-sm font-medium mb-1">{title}</p>
      <h3 className="text-xl md:text-2xl font-bold text-slate-800">{value}</h3>
      <p className={`text-[10px] md:text-xs mt-2 ${subtext.includes('+') ? 'text-green-600' : 'text-slate-400'}`}>{subtext}</p>
    </div>
    <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10`}>
      <Icon className={colorClass} size={20} />
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ products, transactions, onNavigate }) => {
  
  const stats = useMemo(() => {
    const totalSales = transactions
      .filter(t => t.type === TransactionType.SALE)
      .reduce((sum, t) => sum + t.totalAmount, 0);

    const lowStock = products.filter(p => p.stock <= p.minStockLevel).length;
    const totalInventoryValue = products.reduce((sum, p) => sum + (p.stock * p.cost), 0);
    const totalProducts = products.length;

    return { totalSales, lowStock, totalInventoryValue, totalProducts };
  }, [products, transactions]);

  const chartData = useMemo(() => {
    // Group sales by date (last 7 days logic simplified for demo)
    const data: any[] = [];
    const sales = transactions.filter(t => t.type === TransactionType.SALE);
    
    // Sort transactions by date asc
    sales.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Take last 7 sales or group them roughly
    sales.slice(-7).forEach(t => {
       data.push({
         name: new Date(t.date).toLocaleDateString('zh-CN', {month: 'numeric', day: 'numeric'}),
         amount: t.totalAmount
       });
    });
    return data;
  }, [transactions]);

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <header className="mb-4 md:mb-8">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">总览看板</h2>
        <p className="text-sm md:text-base text-slate-500">欢迎回来，这是今天的业务概况。</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard 
          title="累计销售额" 
          value={`¥${stats.totalSales.toLocaleString()}`} 
          subtext="+12% 较上周"
          icon={DollarSign}
          colorClass="text-emerald-600 bg-emerald-100"
        />
        <StatCard 
          title="库存预警" 
          value={stats.lowStock} 
          subtext={stats.lowStock > 0 ? "需尽快补货" : "库存充足"}
          icon={AlertTriangle}
          colorClass="text-amber-600 bg-amber-100"
        />
        <StatCard 
          title="库存总成本" 
          value={`¥${stats.totalInventoryValue.toLocaleString()}`} 
          subtext="当前持有资产"
          icon={Package}
          colorClass="text-indigo-600 bg-indigo-100"
        />
        <StatCard 
          title="在售商品" 
          value={stats.totalProducts} 
          subtext="SKU 数量"
          icon={TrendingUp}
          colorClass="text-purple-600 bg-purple-100"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-slate-100 lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-800 mb-4">近期销售趋势</h3>
          <div className="h-52 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 10}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill: '#64748b', fontSize: 10}} axisLine={false} tickLine={false} tickFormatter={(value) => `¥${value}`} width={35} />
                <Tooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Line type="monotone" dataKey="amount" stroke="#4F46E5" strokeWidth={3} dot={{r: 4, fill: '#4F46E5', strokeWidth: 2, stroke: '#fff'}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions / Alerts */}
        <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4">快捷操作与提醒</h3>
          
          {stats.lowStock > 0 && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
              <div className="flex items-start">
                <AlertTriangle className="text-red-500 mr-2 shrink-0" size={20} />
                <div>
                  <h4 className="text-red-800 font-semibold text-sm">库存不足提醒</h4>
                  <p className="text-red-600 text-xs mt-1">有 {stats.lowStock} 个商品低于安全库存线。</p>
                  <button 
                    onClick={() => onNavigate('purchase')}
                    className="mt-2 text-xs font-medium text-red-700 hover:underline"
                  >
                    去采购补货 &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
             <button onClick={() => onNavigate('sales')} className="w-full py-3 md:py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
               开具销售单
             </button>
             <button onClick={() => onNavigate('purchase')} className="w-full py-3 md:py-2 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors">
               新增采购单
             </button>
             <button onClick={() => onNavigate('inventory')} className="w-full py-3 md:py-2 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors">
               添加新商品
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;