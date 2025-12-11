import React from 'react';
import { LayoutDashboard, Package, ShoppingCart, TrendingUp, Sparkles, Users, Wallet, Settings as SettingsIcon } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const menuItems = [
    { id: 'dashboard', label: '总览看板', icon: LayoutDashboard },
    { id: 'inventory', label: '商品/服务', icon: Package },
    { id: 'sales', label: '销售出库', icon: TrendingUp },
    { id: 'purchase', label: '采购入库', icon: ShoppingCart },
    { id: 'customers', label: '客户/核销', icon: Users },
    { id: 'finance', label: '财务报表', icon: Wallet },
    { id: 'ai-insight', label: '智能分析', icon: Sparkles },
  ];

  return (
    <div className="hidden md:flex w-64 bg-slate-900 text-white flex-col h-full shadow-xl transition-all border-r border-slate-800">
      <div className="p-6 flex items-center space-x-3 border-b border-slate-800">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-900/50">
          <Sparkles size={20} className="text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-wider text-slate-100">贵蓁供销存</h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === item.id 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-4">
         <button
            onClick={() => onTabChange('settings')}
            className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-all duration-200 text-sm ${
              activeTab === 'settings' 
                ? 'bg-slate-800 text-white' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <SettingsIcon size={18} />
            <span className="font-medium">系统设置</span>
          </button>

         <div className="flex items-center space-x-3 text-slate-600 text-xs px-4">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <span>系统正常运行中</span>
         </div>
      </div>
    </div>
  );
};

export default Sidebar;