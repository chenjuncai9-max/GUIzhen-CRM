import React, { useState, useMemo } from 'react';
import { FinanceRecord, Transaction, TransactionType } from '../types';
import { StorageService } from '../services/storage';
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, PieChart, Download } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { exportToCSV } from '../utils/csvExport';

interface FinanceProps {
  financeRecords: FinanceRecord[];
  transactions: Transaction[];
  onUpdate: () => void;
}

const Finance: React.FC<FinanceProps> = ({ financeRecords, transactions, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger'>('overview');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('房租');
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');

  // --- Calculations ---
  const financialStats = useMemo(() => {
      // 1. Sales Gross Profit
      const sales = transactions.filter(t => t.type === TransactionType.SALE);
      const totalRevenue = sales.reduce((sum, t) => sum + t.totalAmount, 0);
      const totalCOGS = sales.reduce((sum, t) => sum + (t.costSnapshot || 0), 0); // Cost of Goods Sold
      const grossProfit = totalRevenue - totalCOGS;

      // 2. Manual Finance Records
      const manualExpense = financeRecords.filter(r => r.type === 'EXPENSE').reduce((sum, r) => sum + r.amount, 0);
      const manualIncome = financeRecords.filter(r => r.type === 'INCOME').reduce((sum, r) => sum + r.amount, 0);

      // 3. Net Profit
      const netProfit = grossProfit + manualIncome - manualExpense;

      return { totalRevenue, totalCOGS, grossProfit, manualExpense, manualIncome, netProfit };
  }, [transactions, financeRecords]);

  // Handle Add Record
  const handleAddRecord = (e: React.FormEvent) => {
      e.preventDefault();
      if (!amount) return;
      
      const newRecord: FinanceRecord = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          type: type,
          amount: Number(amount),
          category: category,
          description: description
      };
      StorageService.addFinanceRecord(newRecord);
      onUpdate();
      setAmount('');
      setDescription('');
  };

  const handleDelete = (id: string) => {
      if(confirm('删除记录?')) {
          StorageService.deleteFinanceRecord(id);
          onUpdate();
      }
  };

  const handleExport = () => {
    const dataToExport = financeRecords.map(r => ({
      date: new Date(r.date).toLocaleDateString(),
      type: r.type === 'INCOME' ? '收入' : '支出',
      category: r.category,
      amount: r.amount,
      description: r.description
    }));

    const headers = [
      { key: 'date', label: '日期' },
      { key: 'type', label: '类型' },
      { key: 'category', label: '分类' },
      { key: 'amount', label: '金额' },
      { key: 'description', label: '备注' },
    ];

    exportToCSV(dataToExport, headers, '财务流水');
  };

  const chartData = [
      { name: '销售收入', value: financialStats.totalRevenue, type: 'INCOME' },
      { name: '其他收入', value: financialStats.manualIncome, type: 'INCOME' },
      { name: '销售成本', value: financialStats.totalCOGS, type: 'COST' },
      { name: '运营支出', value: financialStats.manualExpense, type: 'COST' },
      { name: '净利润', value: financialStats.netProfit, type: 'PROFIT' },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex space-x-2 bg-white p-1 rounded-lg border border-slate-200 w-fit">
          <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'overview' ? 'bg-slate-800 text-white' : 'text-slate-600'}`}>利润报表</button>
          <button onClick={() => setActiveTab('ledger')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'ledger' ? 'bg-slate-800 text-white' : 'text-slate-600'}`}>记账本</button>
      </div>

      {activeTab === 'overview' ? (
          <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-emerald-600 to-green-700 text-white p-6 rounded-xl shadow-lg md:col-span-1">
                      <p className="text-emerald-100 text-sm font-medium mb-1">净利润 (Net Profit)</p>
                      <h3 className="text-3xl font-bold">¥{financialStats.netProfit.toLocaleString()}</h3>
                      <div className="mt-4 text-xs text-emerald-100 flex flex-col gap-1">
                          <span>毛利: ¥{financialStats.grossProfit.toLocaleString()}</span>
                          <span>其他收入: +¥{financialStats.manualIncome.toLocaleString()}</span>
                          <span>运营支出: -¥{financialStats.manualExpense.toLocaleString()}</span>
                      </div>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-slate-500 text-sm font-medium mb-1">销售总额</p>
                      <h3 className="text-2xl font-bold text-slate-800">¥{financialStats.totalRevenue.toLocaleString()}</h3>
                      <p className="text-xs text-red-400 mt-2">商品成本: ¥{financialStats.totalCOGS.toLocaleString()}</p>
                  </div>
                   <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-slate-500 text-sm font-medium mb-1">运营支出</p>
                      <h3 className="text-2xl font-bold text-slate-800">¥{financialStats.manualExpense.toLocaleString()}</h3>
                      <p className="text-xs text-slate-400 mt-2">房租、水电、人工等</p>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-slate-500 text-sm font-medium mb-1">其他收入</p>
                      <h3 className="text-2xl font-bold text-slate-800">¥{financialStats.manualIncome.toLocaleString()}</h3>
                      <p className="text-xs text-slate-400 mt-2">充值、投资等</p>
                  </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-800 mb-6">财务概况图表</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{bottom: 20}}>
                            <XAxis 
                              dataKey="name" 
                              fontSize={11} 
                              tickLine={false} 
                              axisLine={false} 
                              angle={-35} 
                              textAnchor="end"
                              height={60} 
                            />
                            <YAxis fontSize={12} tickLine={false} axisLine={false}/>
                            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: 'none'}} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={
                                        entry.type === 'PROFIT' ? '#059669' : // emerald-600
                                        entry.type === 'INCOME' ? '#4f46e5' : // indigo-600
                                        '#f59e0b' // amber-500 for costs
                                    } />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                  </div>
              </div>
          </div>
      ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
              {/* Form */}
              <div className="lg:col-span-1">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                      <h3 className="font-bold text-slate-800 mb-4">记一笔</h3>
                      <form onSubmit={handleAddRecord} className="space-y-4">
                          <div className="flex gap-2 mb-2">
                              <button type="button" onClick={() => setType('EXPENSE')} className={`flex-1 py-2 text-sm rounded-lg border ${type === 'EXPENSE' ? 'bg-red-50 border-red-200 text-red-600 font-bold' : 'border-slate-200 text-slate-500'}`}>支出</button>
                              <button type="button" onClick={() => setType('INCOME')} className={`flex-1 py-2 text-sm rounded-lg border ${type === 'INCOME' ? 'bg-green-50 border-green-200 text-green-600 font-bold' : 'border-slate-200 text-slate-500'}`}>其他收入</button>
                          </div>
                          <div>
                              <label className="block text-sm text-slate-600 mb-1">金额</label>
                              <input type="number" required className="w-full border rounded-lg p-2" value={amount} onChange={e => setAmount(e.target.value)} />
                          </div>
                          <div>
                              <label className="block text-sm text-slate-600 mb-1">分类</label>
                              <select className="w-full border rounded-lg p-2" value={category} onChange={e => setCategory(e.target.value)}>
                                  {type === 'EXPENSE' ? (
                                      ['房租', '水电', '人工', '营销', '其他'].map(c => <option key={c} value={c}>{c}</option>)
                                  ) : (
                                      ['充值', '投资收益', '其他'].map(c => <option key={c} value={c}>{c}</option>)
                                  )}
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm text-slate-600 mb-1">备注</label>
                              <input type="text" className="w-full border rounded-lg p-2" value={description} onChange={e => setDescription(e.target.value)} />
                          </div>
                          <button type="submit" className="w-full bg-slate-800 text-white py-2 rounded-lg mt-2">保存记录</button>
                      </form>
                  </div>
              </div>

              {/* List */}
              <div className="lg:col-span-2">
                   <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
                       <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                          <h4 className="font-bold text-slate-700">收支明细</h4>
                          <button 
                            onClick={handleExport}
                            className="p-1.5 bg-white border border-slate-200 rounded text-slate-600 hover:text-indigo-600 transition-colors"
                            title="导出明细"
                          >
                            <Download size={16} />
                          </button>
                       </div>
                       <div className="overflow-auto flex-1">
                        <table className="w-full text-left text-sm">
                           <thead className="bg-slate-50 text-slate-600 sticky top-0">
                               <tr>
                                   <th className="px-6 py-3">日期</th>
                                   <th className="px-6 py-3">分类</th>
                                   <th className="px-6 py-3">备注</th>
                                   <th className="px-6 py-3 text-right">金额</th>
                                   <th className="px-6 py-3 text-center">操作</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                               {financeRecords.map(r => (
                                   <tr key={r.id}>
                                       <td className="px-6 py-3 text-slate-500">{new Date(r.date).toLocaleDateString()}</td>
                                       <td className="px-6 py-3 font-medium">{r.category}</td>
                                       <td className="px-6 py-3 text-slate-500">{r.description || '-'}</td>
                                       <td className={`px-6 py-3 text-right font-bold ${r.type === 'INCOME' ? 'text-green-600' : 'text-slate-800'}`}>
                                           {r.type === 'EXPENSE' ? '-' : '+'}¥{r.amount}
                                       </td>
                                       <td className="px-6 py-3 text-center">
                                           <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                       </td>
                                   </tr>
                               ))}
                               {financeRecords.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">暂无记录</td></tr>}
                           </tbody>
                       </table>
                       </div>
                   </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Finance;