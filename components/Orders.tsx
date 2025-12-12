import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, Transaction, TransactionType, Customer } from '../types';
import { ShoppingCart, TrendingUp, CheckCircle, Search, Clock, User, PlusCircle, Download, ScanBarcode, X, Upload, ChevronDown, UserPlus, Phone } from 'lucide-react';
import { exportToCSV, parseCSV } from '../utils/csvExport';
import { StorageService } from '../services/storage';
// @ts-ignore
import { Html5Qrcode } from "html5-qrcode";

interface OrdersProps {
  type: TransactionType; // SALE or PURCHASE
  products: Product[];
  transactions: Transaction[];
  customers: Customer[]; // Pass customers
  onSubmitOrder: (t: Transaction) => void;
  onBatchSubmitOrder: (ts: Transaction[]) => void;
}

interface AutocompleteOption {
  id: string;
  label: string;
  subLabel?: string;
  searchText: string;
}

const AutocompleteSelect = ({ 
  options, 
  value, 
  onChange, 
  placeholder,
  required = false
}: { 
  options: AutocompleteOption[], 
  value: string, 
  onChange: (val: string) => void, 
  placeholder: string,
  required?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal search state when external value changes
  useEffect(() => {
    const selected = options.find(o => o.id === value);
    if (selected) {
      setSearch(selected.label);
    } else if (!value) {
      setSearch('');
    }
  }, [value, options]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // If nothing selected (value is empty) but text exists, reset text
        const selected = options.find(o => o.id === value);
        if (selected) {
             setSearch(selected.label);
        } else {
             setSearch('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, options]);

  const filtered = useMemo(() => {
      if (!search) return options;
      const lower = search.toLowerCase();
      return options.filter(o => o.searchText.toLowerCase().includes(lower));
  }, [options, search]);

  const handleSelect = (id: string) => {
      onChange(id);
      setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
       <div className="relative">
          <input
            type="text"
            required={required && !value} // Only required if no value selected
            className="w-full border border-slate-300 rounded-lg p-3 pl-10 pr-8 bg-white focus:ring-2 focus:ring-indigo-500 text-sm md:text-base transition-shadow"
            placeholder={placeholder}
            value={search}
            onChange={e => {
                setSearch(e.target.value);
                setIsOpen(true);
                if (value) onChange(''); // Reset selection if typing
            }}
            onFocus={() => setIsOpen(true)}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          {value ? (
            <button
                type="button"
                onClick={() => { onChange(''); setSearch(''); setIsOpen(true); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 bg-white"
            >
                <X size={16} />
            </button>
          ) : (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
               <ChevronDown size={14} />
            </div>
          )}
       </div>

       {isOpen && (
         <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
            {filtered.length > 0 ? (
                <ul>
                    {filtered.map(opt => (
                        <li 
                            key={opt.id}
                            onClick={() => handleSelect(opt.id)}
                            className={`px-4 py-3 cursor-pointer border-b border-slate-50 last:border-none flex flex-col ${opt.id === value ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                        >
                            <span className="font-medium text-slate-800 text-sm">{opt.label}</span>
                            {opt.subLabel && <span className="text-xs text-slate-400 mt-0.5">{opt.subLabel}</span>}
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="p-4 text-center text-slate-400 text-sm">无匹配结果</div>
            )}
         </div>
       )}
    </div>
  );
};

const Orders: React.FC<OrdersProps> = ({ type, products, transactions, customers, onSubmitOrder, onBatchSubmitOrder }) => {
  const isSale = type === TransactionType.SALE;
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [partyName, setPartyName] = useState(''); // Generic Input (Supplier Name)
  
  // Sales specific states
  const [selectedCustomerId, setSelectedCustomerId] = useState(''); 
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const [filterTerm, setFilterTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const totalAmount = selectedProduct 
    ? (isSale ? selectedProduct.price : selectedProduct.cost) * quantity 
    : 0;

  // Prepare Options for Autocomplete
  const productOptions = useMemo(() => products.map(p => ({
    id: p.id,
    label: p.name,
    subLabel: `${p.sku} | ${p.type !== 'GOODS' ? '服务/卡项' : `库存: ${p.stock}`}`,
    searchText: `${p.name} ${p.sku}`
  })), [products]);

  const customerOptions = useMemo(() => customers.map(c => ({
    id: c.id,
    label: c.name,
    subLabel: c.phone,
    searchText: `${c.name} ${c.phone}`
  })), [customers]);

  // --- Scanner Logic ---
  const startScanning = () => {
      setIsScanning(true);
      setTimeout(() => {
          if (!document.getElementById("reader")) return;
          
          const html5QrCode = new Html5Qrcode("reader", { experimentalFeatures: { useBarCodeDetectorIfSupported: true } });
          scannerRef.current = html5QrCode;

          const config = { 
              fps: 15, 
              qrbox: { width: 300, height: 150 }, 
              aspectRatio: 1.0,
              disableFlip: false
          };
          
          html5QrCode.start(
              { facingMode: "environment" },
              config,
              (decodedText: string) => {
                  handleScanSuccess(decodedText);
              },
              (errorMessage: any) => { }
          ).catch((err: any) => {
              console.error("Camera start failed", err);
              alert("无法启动相机，请确保已授予相机权限。");
              setIsScanning(false);
          });
      }, 100);
  };

  const stopScanning = () => {
      if (scannerRef.current) {
          scannerRef.current.stop().then(() => {
              try {
                scannerRef.current?.clear();
              } catch(e) { console.warn(e); }
              scannerRef.current = null;
              setIsScanning(false);
          }).catch((err: any) => {
              console.error("Failed to stop scanner", err);
              setIsScanning(false);
          });
      } else {
          setIsScanning(false);
      }
  };

  const handleScanSuccess = (decodedText: string) => {
      const found = products.find(p => p.sku === decodedText || p.id === decodedText || p.name === decodedText);
      
      if (found) {
          setSelectedProductId(found.id);
          const audio = new Audio('https://www.soundjay.com/buttons/sounds/button-3.mp3'); 
          audio.play().catch(e => {}); 
          stopScanning();
      } else {
          alert(`扫码成功，但未找到匹配商品 (条码: ${decodedText})`);
          stopScanning();
      }
  };

  useEffect(() => {
      return () => {
          if (scannerRef.current && isScanning) {
              scannerRef.current.stop().catch(console.error);
          }
      };
  }, [isScanning]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    // Stock check
    if (isSale && selectedProduct.type === 'GOODS' && selectedProduct.stock < quantity) {
      alert('库存不足，无法销售！');
      return;
    }

    // Determine Party Info
    let finalPartyId = selectedCustomerId;
    let finalPartyName = partyName; // default for purchase

    // Logic for Sales
    if (isSale) {
        if (selectedCustomerId) {
            // Existing customer
            const c = customers.find(cust => cust.id === selectedCustomerId);
            finalPartyName = c ? c.name : '未知客户';
        } else if (newCustomerName) {
            // Create New Customer Logic
            const newCustomer: Customer = {
                id: Date.now().toString(),
                name: newCustomerName,
                phone: newCustomerPhone,
                cards: [],
                notes: '交易时自动创建',
                lastActivity: new Date().toISOString()
            };
            
            // Save immediately
            StorageService.saveCustomer(newCustomer);
            
            finalPartyId = newCustomer.id;
            finalPartyName = newCustomer.name;
        } else {
            // Truly Walk-in
            finalPartyName = '散客';
            finalPartyId = ''; // No ID means no card tracking
        }
    } else {
        // Purchase
        if (!finalPartyName) finalPartyName = '供应商';
    }

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type: type,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: quantity,
      totalAmount: totalAmount,
      partyName: finalPartyName,
      partyId: finalPartyId || undefined, 
      costSnapshot: selectedProduct.cost * quantity 
    };

    onSubmitOrder(newTransaction);
    
    // Reset Form
    setSelectedProductId('');
    setQuantity(1);
    setPartyName('');
    setSelectedCustomerId('');
    setNewCustomerName('');
    setNewCustomerPhone('');

    const successMsg = isSale 
        ? (newCustomerName ? `已自动创建客户“${newCustomerName}”并生成销售单！` : '销售单已生成！') 
        : '采购单已生成！';
    alert(successMsg);
  };

  const filteredTransactions = transactions
    .filter(t => t.type === type)
    .filter(t => 
      (t.productName || '').toLowerCase().includes(filterTerm.toLowerCase()) || 
      t.partyName.toLowerCase().includes(filterTerm.toLowerCase())
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleExport = () => {
    const dataToExport = filteredTransactions.map(t => ({
      dateFormatted: new Date(t.date).toLocaleString('zh-CN'),
      typeFormatted: t.type === TransactionType.SALE ? '销售' : '进货',
      productName: t.productName,
      partyName: t.partyName,
      quantity: t.quantity,
      totalAmount: t.totalAmount
    }));
    
    const headers = [
      { key: 'dateFormatted', label: '时间' },
      { key: 'typeFormatted', label: '类型' },
      { key: 'productName', label: '商品名称' },
      { key: 'partyName', label: '对方名称' },
      { key: 'quantity', label: '数量' },
      { key: 'totalAmount', label: '总金额' },
    ];

    exportToCSV(dataToExport, headers, isSale ? '销售记录' : '采购记录');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.length === 0) { alert('文件为空'); return; }

        const newTransactions: Transaction[] = [];
        let errors = 0;

        parsed.forEach((row: any) => {
            const pName = row['商品名称'] || row['productName'];
            const qty = Number(row['数量'] || row['quantity'] || 0);
            const amt = Number(row['总金额'] || row['totalAmount'] || 0);
            const product = products.find(p => p.name === pName || p.sku === pName);

            if (pName && qty > 0) {
                 newTransactions.push({
                    id: Date.now().toString() + Math.random().toString().slice(2,6),
                    date: row['时间'] ? new Date(row['时间']).toISOString() : new Date().toISOString(),
                    type: type,
                    productId: product?.id,
                    productName: pName,
                    quantity: qty,
                    totalAmount: amt || (product ? (isSale ? product.price : product.cost) * qty : 0),
                    partyName: row['对方名称'] || row['partyName'] || (isSale ? '散客' : '供应商'),
                    costSnapshot: product ? product.cost * qty : 0 
                 });
            } else {
                errors++;
            }
        });

        if (newTransactions.length > 0) {
            if (confirm(`解析到 ${newTransactions.length} 条有效记录，确定导入吗？`)) {
                onBatchSubmitOrder(newTransactions);
                alert('导入成功，库存已更新。');
            }
        } else {
            alert('未找到有效数据，请检查CSV格式：商品名称,数量,总金额,对方名称...');
        }

      } catch (err) {
        console.error(err);
        alert('导入失败，文件格式错误');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
      
      {/* Create Order Form */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 md:p-6 lg:sticky lg:top-6">
          <div className="flex items-center space-x-3 mb-6">
             <div className={`p-2 rounded-lg ${isSale ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {isSale ? <TrendingUp size={24} /> : <ShoppingCart size={24} />}
             </div>
             <h2 className="text-xl font-bold text-slate-800">{isSale ? '销售出库' : '采购入库'}</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">选择商品/服务</label>
              <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <AutocompleteSelect 
                        options={productOptions}
                        value={selectedProductId}
                        onChange={setSelectedProductId}
                        placeholder="搜索商品名或条码..."
                        required={true}
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={startScanning}
                    className="p-3 bg-slate-100 border border-slate-300 rounded-lg text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
                    title="扫码识别"
                  >
                      <ScanBarcode size={20} />
                  </button>
              </div>
            </div>

            {/* Customer Selection Logic */}
            {isSale ? (
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">客户</label>
                    <AutocompleteSelect 
                        options={customerOptions}
                        value={selectedCustomerId}
                        onChange={setSelectedCustomerId}
                        placeholder="搜索选择已有客户..."
                        required={false}
                    />
                    
                    {/* New Customer Input - Shows only if no existing customer selected */}
                    {!selectedCustomerId && (
                        <div className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center space-x-2 mb-2 text-indigo-600">
                                <UserPlus size={16} />
                                <span className="text-xs font-bold">新散客自动建档 (可选)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input 
                                    type="text"
                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
                                    placeholder="散客姓名"
                                    value={newCustomerName}
                                    onChange={e => setNewCustomerName(e.target.value)}
                                />
                                <div className="relative">
                                    <input 
                                        type="text"
                                        className="w-full border border-slate-300 rounded-lg p-2 pl-8 text-sm bg-white"
                                        placeholder="电话号码"
                                        value={newCustomerPhone}
                                        onChange={e => setNewCustomerPhone(e.target.value)}
                                    />
                                    <Phone size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 ml-1">填写姓名后，系统将自动创建该客户档案。</p>
                        </div>
                    )}
                </div>
            ) : (
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">供应商名称</label>
                    <input 
                        type="text"
                        className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="选填 (默认供应商)"
                        value={partyName}
                        onChange={e => setPartyName(e.target.value)}
                    />
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">数量</label>
                <input 
                  type="number"
                  min="1"
                  required
                  className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 text-lg font-bold text-center"
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">单价</label>
                <div className="w-full border border-slate-200 bg-slate-100 rounded-lg p-3 text-slate-500 text-lg text-center">
                  ¥{selectedProduct ? (isSale ? selectedProduct.price : selectedProduct.cost) : 0}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 mt-2">
               <div className="flex justify-between items-end mb-4">
                  <span className="text-slate-500 text-sm">订单总额</span>
                  <span className="text-3xl font-bold text-slate-800">¥{totalAmount.toLocaleString()}</span>
               </div>
               <button 
                type="submit"
                className={`w-full py-3.5 rounded-lg text-white font-bold text-lg flex justify-center items-center space-x-2 transition-transform active:scale-95 shadow-md ${
                  isSale ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
               >
                 <CheckCircle size={22} />
                 <span>确认{isSale ? '出库' : '入库'}</span>
               </button>
            </div>
          </form>
        </div>
      </div>

      {/* Scanner Overlay Modal */}
      {isScanning && (
          <div className="fixed inset-0 z-[100] bg-black bg-opacity-90 flex flex-col items-center justify-center p-4">
              <div className="w-full max-w-md bg-transparent rounded-xl overflow-hidden relative">
                  <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent">
                      <h3 className="text-white font-bold text-lg flex items-center">
                          <ScanBarcode className="mr-2"/> 扫描商品条码
                      </h3>
                      <button onClick={stopScanning} className="text-white bg-white/20 p-2 rounded-full hover:bg-white/30">
                          <X size={24} />
                      </button>
                  </div>
                  
                  {/* Scanner Render Container */}
                  <div id="reader" className="w-full h-80 bg-black rounded-lg overflow-hidden border-2 border-slate-600"></div>

                  <p className="text-center text-slate-400 mt-4 text-sm">
                      请将条形码置于框内，<span className="text-yellow-400 font-bold">并适当调整手机距离以对焦</span>
                      <br/>
                      <span className="text-xs opacity-60">支持检测常见商品条码 (EAN/UPC)</span>
                  </p>
              </div>
          </div>
      )}

      {/* Transaction History List */}
      <div className="lg:col-span-2">
         <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full md:min-h-[500px]">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h3 className="font-bold text-slate-800 text-lg">历史记录</h3>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input 
                    type="file" 
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                />
                <button 
                    onClick={handleImportClick}
                    className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                    title="导入CSV"
                >
                    <Upload size={18} />
                </button>
                <button 
                    onClick={handleExport}
                    className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                    title="导出记录"
                >
                    <Download size={18} />
                </button>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                    type="text" 
                    placeholder="搜索记录..." 
                    value={filterTerm}
                    onChange={e => setFilterTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                </div>
              </div>
            </div>
            
            <div className="overflow-auto flex-1 p-0">
               <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                 <thead className="bg-slate-50 sticky top-0 z-10">
                   <tr>
                     <th className="px-4 md:px-6 py-3 font-medium text-slate-600">商品</th>
                     <th className="hidden md:table-cell px-6 py-3 font-medium text-slate-600">时间</th>
                     <th className="hidden sm:table-cell px-6 py-3 font-medium text-slate-600">对方名称</th>
                     <th className="px-4 md:px-6 py-3 font-medium text-slate-600 text-right">数量</th>
                     <th className="px-4 md:px-6 py-3 font-medium text-slate-600 text-right">金额</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="px-4 md:px-6 py-3">
                          <div className="font-medium text-slate-800 text-base">{t.productName}</div>
                          <div className="md:hidden text-xs text-slate-400 mt-1 flex items-center">
                             <Clock size={10} className="mr-1"/>
                             {new Date(t.date).toLocaleDateString('zh-CN')}
                          </div>
                          <div className="sm:hidden text-xs text-slate-400 mt-0.5 flex items-center">
                             <User size={10} className="mr-1"/>
                             {t.partyName}
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-6 py-3 text-slate-500">
                          {new Date(t.date).toLocaleString('zh-CN')}
                        </td>
                        <td className="hidden sm:table-cell px-6 py-3 text-slate-600">{t.partyName}</td>
                        <td className="px-4 md:px-6 py-3 text-right">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${isSale ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                            {isSale ? '出 ' : '入 '}{t.quantity}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-3 text-right font-medium text-base">¥{t.totalAmount}</td>
                      </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">暂无相关记录</td>
                      </tr>
                    )}
                 </tbody>
               </table>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Orders;