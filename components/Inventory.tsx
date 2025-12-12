import React, { useState, useRef, useEffect } from 'react';
import { Product, ProductType } from '../types';
import { Search, Plus, Edit2, Trash2, AlertCircle, Package, CreditCard, CalendarClock, Download, ScanBarcode, X, Filter, AlertTriangle, Upload } from 'lucide-react';
import { exportToCSV, parseCSV } from '../utils/csvExport';
// @ts-ignore
import { Html5Qrcode } from "html5-qrcode";

interface InventoryProps {
  products: Product[];
  onAddProduct: (p: Product) => void;
  onBatchAddProduct: (products: Product[]) => void;
  onDeleteProduct: (id: string) => void;
  initialFilter?: 'ALL' | 'LOW_STOCK';
}

const Inventory: React.FC<InventoryProps> = ({ products, onAddProduct, onBatchAddProduct, onDeleteProduct, initialFilter = 'ALL' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'LOW_STOCK'>(initialFilter);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync filter if changed from parent (e.g. Dashboard navigation)
  useEffect(() => {
    setFilterType(initialFilter);
  }, [initialFilter]);

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', category: '', sku: '', price: 0, cost: 0, stock: 0, minStockLevel: 5, type: ProductType.GOODS, value: 0
  });

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'LOW_STOCK') {
       return p.type === ProductType.GOODS && p.stock <= p.minStockLevel;
    }

    return true;
  });

  const lowStockCount = products.filter(p => p.type === ProductType.GOODS && p.stock <= p.minStockLevel).length;

  const handleExport = () => {
      const dataToExport = filteredProducts.map(p => ({
          ...p,
          typeName: p.type === ProductType.GOODS ? '实物' : (p.type === ProductType.SERVICE_COUNT ? '次卡' : '期限卡'),
          stockDisplay: p.type === ProductType.GOODS ? p.stock : '无限',
          valueDisplay: p.value || '-'
      }));

      const headers = [
          { key: 'name', label: '商品名称' },
          { key: 'category', label: '分类' },
          { key: 'sku', label: 'SKU' },
          { key: 'price', label: '售价' },
          { key: 'cost', label: '成本' },
          { key: 'stock', label: '库存' },
          { key: 'minStockLevel', label: '预警库存' },
          { key: 'type', label: '类型(GOODS/SERVICE_COUNT/SERVICE_TIME)' },
          { key: 'value', label: '卡项含值' },
      ];

      exportToCSV(dataToExport, headers, '库存列表');
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
        
        if (parsed.length === 0) {
            alert('文件为空或格式不正确');
            return;
        }

        const newProducts: Product[] = parsed.map((row: any) => ({
            id: Date.now().toString() + Math.random().toString().slice(2, 6),
            name: row['商品名称'] || row['name'] || '未命名',
            category: row['分类'] || row['category'] || '默认',
            sku: row['SKU'] || row['sku'] || 'SKU-' + Math.random().toString().slice(2, 8),
            price: Number(row['售价'] || row['price'] || 0),
            cost: Number(row['成本'] || row['cost'] || 0),
            stock: Number(row['库存'] || row['stock'] || 0),
            minStockLevel: Number(row['预警库存'] || row['minStockLevel'] || 5),
            type: (row['类型'] || row['type'] || 'GOODS') as ProductType, // Loose mapping
            value: Number(row['卡项含值'] || row['value'] || 0)
        }));
        
        if (confirm(`解析到 ${newProducts.length} 条数据，确定导入吗？`)) {
            onBatchAddProduct(newProducts);
            alert('导入成功');
        }
      } catch (err) {
        console.error(err);
        alert('导入失败，请检查文件格式。应包含表头：商品名称,分类,SKU,售价,成本,库存...');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // --- Scanner Logic ---
  const startScanning = () => {
      setIsScanning(true);
      setTimeout(() => {
          if (!document.getElementById("reader-inventory")) return;
          
          // Use experimental feature for native barcode detection
          const html5QrCode = new Html5Qrcode("reader-inventory", { experimentalFeatures: { useBarCodeDetectorIfSupported: true } });
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
                  // ignore errors
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
      setFormData(prev => ({ ...prev, sku: decodedText }));
      
      // Play a beep sound
      const audio = new Audio('https://www.soundjay.com/buttons/sounds/button-3.mp3'); 
      audio.play().catch(e => {}); 
      
      stopScanning();
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
    const newProduct: Product = {
      id: editingProduct ? editingProduct.id : Date.now().toString(),
      name: formData.name || '未命名',
      category: formData.category || '默认',
      sku: formData.sku || 'SKU-' + Date.now(),
      price: Number(formData.price),
      cost: Number(formData.cost),
      stock: Number(formData.stock),
      minStockLevel: Number(formData.minStockLevel),
      type: formData.type || ProductType.GOODS,
      value: Number(formData.value)
    };
    onAddProduct(newProduct);
    closeModal();
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({ name: '', category: '', sku: '', price: 0, cost: 0, stock: 0, minStockLevel: 5, type: ProductType.GOODS, value: 0 });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const getTypeIcon = (type: ProductType) => {
      switch(type) {
          case ProductType.SERVICE_COUNT: return <CreditCard size={14} className="text-purple-500" />;
          case ProductType.SERVICE_TIME: return <CalendarClock size={14} className="text-orange-500" />;
          default: return <Package size={14} className="text-slate-500" />;
      }
  };

  const getTypeLabel = (type: ProductType) => {
      switch(type) {
          case ProductType.SERVICE_COUNT: return '次卡';
          case ProductType.SERVICE_TIME: return '期限卡';
          default: return '实物';
      }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-xl md:text-2xl font-bold text-slate-800">商品与服务</h2>
           <div className="flex space-x-2 mt-2">
              <button 
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${filterType === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                全部商品
              </button>
              <button 
                onClick={() => setFilterType('LOW_STOCK')}
                className={`px-3 py-1 text-sm rounded-full border flex items-center space-x-1 transition-colors ${filterType === 'LOW_STOCK' ? 'bg-amber-100 text-amber-800 border-amber-200 ring-1 ring-amber-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                <AlertTriangle size={12} className={filterType === 'LOW_STOCK' ? 'text-amber-600' : 'text-slate-400'}/>
                <span>库存预警</span>
                {lowStockCount > 0 && <span className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 rounded-full">{lowStockCount}</span>}
              </button>
           </div>
        </div>
        
        <div className="flex space-x-2 w-full md:w-auto">
            <input 
                type="file" 
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
            />
            <button 
                onClick={handleImportClick}
                className="flex-1 md:flex-none flex items-center justify-center space-x-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors text-sm md:text-base shadow-sm"
                title="导入CSV"
            >
                <Upload size={18} />
                <span className="hidden md:inline">导入</span>
            </button>
            <button 
                onClick={handleExport}
                className="flex-1 md:flex-none flex items-center justify-center space-x-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors text-sm md:text-base shadow-sm"
            >
                <Download size={18} />
                <span className="hidden md:inline">导出</span>
            </button>
            <button 
            onClick={() => openModal()}
            className="flex-1 md:flex-none flex items-center justify-center space-x-1 md:space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 md:px-4 rounded-lg transition-colors text-sm md:text-base shadow-sm"
            >
            <Plus size={18} />
            <span>新增</span>
            </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="搜索商品名称或条码..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {filteredProducts.map(product => (
          <div key={product.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-slate-800 text-base">{product.name}</h3>
                    <span className="flex items-center space-x-1 text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                        {getTypeIcon(product.type)}
                        <span className="text-slate-600">{getTypeLabel(product.type)}</span>
                    </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">{product.category} | {product.sku}</div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-indigo-600">¥{product.price}</p>
                <p className="text-xs text-slate-400">成本 ¥{product.cost}</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between border-t border-slate-50 pt-3 mt-1">
               <div className="flex items-center space-x-2 text-sm">
                  {product.type === ProductType.GOODS ? (
                      <>
                        <span className="text-slate-500">库存:</span>
                        <span className={`font-bold ${product.stock <= product.minStockLevel ? 'text-red-500' : 'text-slate-800'}`}>
                          {product.stock}
                        </span>
                      </>
                  ) : (
                      <span className="text-slate-500 italic">无需库存</span>
                  )}
               </div>
               <div className="flex space-x-3">
                  <button onClick={() => openModal(product)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => onDeleteProduct(product.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full">
                    <Trash2 size={18} />
                  </button>
               </div>
            </div>
          </div>
        ))}
        {filteredProducts.length === 0 && (
            <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Package size={32} className="mx-auto mb-2 opacity-50"/>
                <p>暂无符合条件的商品</p>
            </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium">
            <tr>
              <th className="px-6 py-4">商品名称</th>
              <th className="px-6 py-4">类型</th>
              <th className="px-6 py-4 text-right">进价</th>
              <th className="px-6 py-4 text-right">售价</th>
              <th className="px-6 py-4 text-center">库存</th>
              <th className="px-6 py-4 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredProducts.map(product => (
              <tr key={product.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-semibold text-slate-800">{product.name}</td>
                <td className="px-6 py-4">
                     <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs ${product.type === ProductType.GOODS ? 'bg-slate-100 text-slate-600' : 'bg-purple-100 text-purple-600'}`}>
                        {getTypeIcon(product.type)}
                        <span>{getTypeLabel(product.type)}</span>
                     </span>
                </td>
                <td className="px-6 py-4 text-right text-slate-600">¥{product.cost}</td>
                <td className="px-6 py-4 text-right font-medium text-slate-800">¥{product.price}</td>
                <td className="px-6 py-4 text-center">
                    {product.type === ProductType.GOODS ? (
                        <span className={product.stock <= product.minStockLevel ? 'text-red-600 font-bold' : ''}>
                            {product.stock}
                        </span>
                    ) : '-'}
                </td>
                <td className="px-6 py-4 text-center">
                   <div className="flex justify-center space-x-2">
                    <button onClick={() => openModal(product)} className="text-indigo-600"><Edit2 size={16}/></button>
                    <button onClick={() => onDeleteProduct(product.id)} className="text-red-400"><Trash2 size={16}/></button>
                   </div>
                </td>
              </tr>
            ))}
             {filteredProducts.length === 0 && (
                <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                        <Package size={24} className="mx-auto mb-2 opacity-50"/>
                        暂无符合条件的商品
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal - Bottom Sheet on Mobile, Centered on Desktop */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white rounded-t-2xl md:rounded-xl w-full max-w-lg shadow-2xl flex flex-col h-[90vh] md:h-auto md:max-h-[90vh] animate-in slide-in-from-bottom-full md:slide-in-from-bottom-10 duration-300">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-slate-800">{editingProduct ? '编辑商品' : '新增商品/服务'}</h3>
              <button onClick={closeModal} className="text-slate-400 text-2xl p-2 hover:bg-slate-100 rounded-full">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">商品类型</label>
                <div className="grid grid-cols-3 gap-2">
                    {[ProductType.GOODS, ProductType.SERVICE_COUNT, ProductType.SERVICE_TIME].map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setFormData({...formData, type: t})}
                            className={`py-3 px-1 text-xs md:text-sm border rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all ${formData.type === t ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500' : 'border-slate-200 hover:bg-slate-50'}`}
                        >
                            {getTypeIcon(t)}
                            {getTypeLabel(t)}
                        </button>
                    ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">名称</label>
                  <input required type="text" className="w-full border border-slate-300 rounded-lg p-3 text-base" placeholder="请输入商品名称" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                
                {/* Dynamic Field based on Type */}
                {formData.type === ProductType.SERVICE_COUNT && (
                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">包含次数</label>
                        <input type="number" className="w-full border border-slate-300 rounded-lg p-3 text-base" placeholder="例如: 10" value={formData.value || ''} onChange={e => setFormData({...formData, value: Number(e.target.value)})} />
                    </div>
                )}
                {formData.type === ProductType.SERVICE_TIME && (
                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">有效期 (天数)</label>
                        <input type="number" className="w-full border border-slate-300 rounded-lg p-3 text-base" placeholder="例如: 365" value={formData.value || ''} onChange={e => setFormData({...formData, value: Number(e.target.value)})} />
                    </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">分类</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-3 text-base" placeholder="例如: 饮料" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SKU (条码)</label>
                  <div className="flex space-x-2">
                      <input type="text" className="flex-1 border border-slate-300 rounded-lg p-3 text-base" placeholder="扫描或输入" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
                      <button 
                        type="button" 
                        onClick={startScanning}
                        className="px-3 bg-slate-100 border border-slate-300 rounded-lg text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
                        title="扫码"
                      >
                          <ScanBarcode size={24} />
                      </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">成本 (¥)</label>
                  <input required type="number" className="w-full border border-slate-300 rounded-lg p-3 text-base" value={formData.cost} onChange={e => setFormData({...formData, cost: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">售价 (¥)</label>
                  <input required type="number" className="w-full border border-slate-300 rounded-lg p-3 text-base" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
                </div>
                
                {formData.type === ProductType.GOODS && (
                    <>
                        <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">当前库存</label>
                        <input required type="number" className="w-full border border-slate-300 rounded-lg p-3 text-base" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} />
                        </div>
                        <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">预警库存</label>
                        <input required type="number" className="w-full border border-slate-300 rounded-lg p-3 text-base" value={formData.minStockLevel} onChange={e => setFormData({...formData, minStockLevel: Number(e.target.value)})} />
                        </div>
                    </>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 flex justify-end space-x-3 bg-slate-50 rounded-b-xl sticky bottom-0 z-10">
                 <button type="button" onClick={closeModal} className="px-5 py-3 text-slate-600 font-medium">取消</button>
                 <button type="submit" className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  <div id="reader-inventory" className="w-full h-80 bg-black rounded-lg overflow-hidden border-2 border-slate-600"></div>

                  <p className="text-center text-slate-400 mt-4 text-sm">
                      请将条形码置于框内，<span className="text-yellow-400 font-bold">并适当调整手机距离以对焦</span>
                      <br/>
                      <span className="text-xs opacity-60">支持检测常见商品条码 (EAN/UPC)</span>
                  </p>
              </div>
          </div>
      )}

    </div>
  );
};

export default Inventory;