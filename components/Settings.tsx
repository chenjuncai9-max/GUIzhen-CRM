import React, { useRef, useState } from 'react';
import { StorageService } from '../services/storage';
import { Download, Upload, AlertTriangle, Save, RefreshCw, Smartphone, ArrowRightLeft } from 'lucide-react';
import DataSync from './DataSync';

interface SettingsProps {
  onDataRestored: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onDataRestored }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);

  const handleBackup = () => {
    const data = StorageService.getAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ssi_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (confirm('警告：恢复备份将覆盖当前所有数据，且无法撤销。确定要继续吗？')) {
           const success = StorageService.restoreData(json);
           if (success) {
             alert('数据恢复成功！');
             onDataRestored();
           } else {
             alert('数据格式错误，恢复失败。');
           }
        }
      } catch (err) {
        alert('无效的备份文件或文件损坏。');
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto pt-4 md:pt-0">
      <header className="mb-6 md:mb-8">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">系统设置</h2>
        <p className="text-sm md:text-base text-slate-500">管理数据备份与同步</p>
      </header>

      {/* New Sync Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl shadow-lg text-white overflow-hidden mb-6">
         <div className="p-6">
            <div className="flex items-center space-x-3 mb-3">
               <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Smartphone size={24} className="text-white" />
               </div>
               <h3 className="text-lg font-bold">多设备数据同步</h3>
            </div>
            <p className="text-indigo-100 text-sm mb-6 leading-relaxed opacity-90">
               换手机或想在电脑上使用？使用此功能可以快速将当前数据直接传输到新设备，无需下载文件。
            </p>
            <button 
              onClick={() => setShowSyncModal(true)}
              className="w-full bg-white text-indigo-600 font-bold py-3 rounded-lg shadow-sm hover:bg-indigo-50 transition-colors flex items-center justify-center space-x-2"
            >
               <ArrowRightLeft size={18} />
               <span>开始同步数据</span>
            </button>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
           <div className="flex items-center space-x-3 mb-2">
             <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
               <Save size={20} />
             </div>
             <h3 className="text-lg font-bold text-slate-800">本地文件备份</h3>
           </div>
           <p className="text-slate-500 text-sm mb-6 leading-relaxed">
             将当前系统中的所有商品、交易、客户及财务数据打包下载为 JSON 文件。
             <br/>建议定期备份以防设备丢失或清理缓存导致数据丢失。
           </p>
           <button 
             onClick={handleBackup}
             className="w-full md:w-auto flex items-center justify-center space-x-2 px-6 py-3 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors shadow-sm"
           >
             <Download size={18} />
             <span>下载备份文件</span>
           </button>
        </div>

        <div className="p-6 bg-slate-50/50">
           <div className="flex items-center space-x-3 mb-2">
             <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
               <RefreshCw size={20} />
             </div>
             <h3 className="text-lg font-bold text-slate-800">文件恢复</h3>
           </div>
           <p className="text-slate-500 text-sm mb-4 leading-relaxed">
             上传之前的备份文件以恢复数据。
           </p>
           <div className="flex items-start p-3 bg-red-50 text-red-700 rounded-lg text-xs md:text-sm mb-6 border border-red-100">
               <AlertTriangle size={16} className="mr-2 mt-0.5 shrink-0"/>
               <span>
                 注意：恢复操作会<strong>完全覆盖</strong>当前设备上的所有数据！此操作无法撤销。
               </span>
           </div>
           
           <input 
             type="file" 
             accept=".json" 
             ref={fileInputRef}
             onChange={handleFileChange}
             className="hidden" 
           />
           <button 
             onClick={handleRestoreClick}
             className="w-full md:w-auto flex items-center justify-center space-x-2 px-6 py-3 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors shadow-sm"
           >
             <Upload size={18} />
             <span>选择备份文件恢复</span>
           </button>
        </div>
      </div>
      
      <div className="text-center text-slate-400 text-xs mt-12 pb-8">
        <p>贵蓁供销存 v1.2.0</p>
        <p className="mt-1 opacity-60">本地数据存储模式</p>
      </div>

      {showSyncModal && <DataSync onClose={() => setShowSyncModal(false)} onSyncComplete={onDataRestored} />}
    </div>
  );
};

export default Settings;