import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, Transaction, TransactionType, Customer } from '../types';
import { ShoppingCart, TrendingUp, CheckCircle, Search, Clock, User, PlusCircle, Download, ScanBarcode, X } from 'lucide-react';
import { exportToCSV } from '../utils/csvExport';
// @ts-ignore
import { Html5Qrcode } from "html5-qrcode";

interface OrdersProps {
  type: TransactionType; // SALE or PURCHASE
  products: Product[];
  transactions: Transaction[];
  customers: Customer[]; // Pass customers
  onSubmitOrder: (t: Transaction) => void;
}

const Orders: React.FC<OrdersProps> = ({ type, products, transactions, customers, onSubmitOrder }) => {
  const isSale = type === TransactionType.SALE;
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [partyName, setPartyName] = useState(''); // Text input for Purchase or fallback
  const [selectedCustomerId, setSelectedCustomerId] = useState(''); // Dropdown for Sale
  const [filterTerm, setFilterTerm] = useState('');
  
  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const totalAmount = selectedProduct 
    ? (isSale ? selectedProduct.price : selectedProduct.cost) * quantity 
    : 0;

  // --- Scanner Logic ---
  const startScanning = () => {
      setIsScanning(true);
      setTimeout(() => {
          if (!document.getElementById("reader")) return;
          
          // Use experimental feature for native barcode detection (much faster on mobile)
          const html5QrCode = new Html5Qrcode("reader", { experimentalFeatures: { useBarCodeDetectorIfSupported: true } });
          scannerRef.current = html5QrCode;

          // Wider box for 1D barcodes
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
                  // Success callback
                  handleScanSuccess(decodedText);
              },
              (errorMessage: any) => {
                  // ignore errors during scanning
              }
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
      // Try to find product by SKU or ID matching the barcode
      const found = products.find(p => p.sku === decodedText || p.id === decodedText || p.name === decodedText);
      
      if (found) {
          setSelectedProductId(found.id);
          // Play a beep sound
          const audio = new Audio('https://www.soundjay.com/buttons/sounds/button-3.mp3'); 
          audio.play().catch(e => {}); 
          
          stopScanning();
      } else {
          // Visual feedback for scan but not found? 
          // For now just alert or maybe toast. Alert blocks UI so use carefuly.
          // To prevent infinite loop of alerts, we might check if we just alerted.
          // For simplicity, we just log or could show a temporary message overlay.
          console.log(`Scanned ${decodedText} but product not found.`);
          alert(`扫码成功，但未找到匹配商品 (条码: ${decodedText})`);
          stopScanning(); // Stop to let user decide
      }
  };

  // Cleanup scanner on unmount
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

    // Stock check only for GOODS
    if (isSale && selectedProduct.type === 'GOODS' && selectedProduct.stock < quantity) {
      alert('库存不足，无法销售！');
      return;
    }

    // Determine Party Name
    let finalPartyName = partyName;
    if (isSale && selectedCustomerId) {
        const c = customers.find(cust => cust.id === selectedCustomerId);
        if (c) finalPartyName = c.name;
    }
    if (!finalPartyName) finalPartyName = isSale ? '散客' : '供应商';

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type: type,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: quantity,
      totalAmount: totalAmount,
      partyName: finalPartyName,
      partyId: selectedCustomerId || undefined, // Important: Link to customer for Card issuing
      costSnapshot: selectedProduct.cost * quantity // Record cost for profit calc
    };

    onSubmitOrder(newTransaction);
    // Reset
    setSelectedProductId('');
    setQuantity(1);
    setPartyName('');
    setSelectedCustomerId('');
    alert(isSale ? '销售单已生成！(如含卡项已自动发放)' : '采购单已生成！');
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
      ...t,
      dateFormatted: new Date(t.date).toLocaleString('zh-CN'),
      typeFormatted: t.type === TransactionType.SALE ? '销售' : '进货',
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
                    <select 
                      required
                      className="w-full border border-slate-300 rounded-lg p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 appearance-none text-sm md:text-base"
                      value={selectedProductId}
                      onChange={e => setSelectedProductId(e.target.value)}
                    >
                      <option value="">-- 点击选择 --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.type !== 'GOODS' ? '[卡项]' : `(余: ${p.stock})`}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                       <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">客户 (用于发放卡项)</label>
                    <select 
                        className="w-full border border-slate-300 rounded-lg p-3 bg-slate-50 text-sm"
                        value={selectedCustomerId}
                        onChange={e => setSelectedCustomerId(e.target.value)}
                    >
                        <option value="">-- 选择已有客户 --</option>
                        {customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                        ))}
                    </select>
                    {!selectedCustomerId && (
                        <input 
                            type="text"
                            className="w-full border border-slate-300 rounded-lg p-3 mt-2 text-sm"
                            placeholder="或手动输入散客姓名"
                            value={partyName}
                            onChange={e => setPartyName(e.target.value)}
                        />
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