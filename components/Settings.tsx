import React, { useRef, useState } from 'react';
import { CloudStorageService } from '../services/cloudStorage';
import { Download, Upload, AlertTriangle, Save, RefreshCw, Smartphone, ArrowRightLeft } from 'lucide-react';

interface SettingsProps {
  onDataRestored: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onDataRestored }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);

  const handleBackup = async () => {
    try {
      // 简单模拟全量导出，实际可能需要分表。这里以 CloudStorageService 能提供的方法为主
      // 若原 getAllData() 没法用，可组合使用各个 get 方法
      const products = await CloudStorageService.getProducts();
      const customers = await CloudStorageService.getCustomers();
      const transactions = await CloudStorageService.getTransactions();
      const financeRecords = await CloudStorageService.getFinanceRecords();

      const data = {
        products, customers, transactions, financeRecords
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `guizhen_cloud_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
      alert('备份导出失败');
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (confirm('警告：云端恢复会尝试将数据全量覆盖/并入当前云端库（覆盖相同ID）。这是一个繁重的操作，确定要继续吗？')) {
          // Basic validation
          if (json && typeof json === 'object') {
            if (json.products) await CloudStorageService.batchSaveProducts(json.products);
            if (json.customers) await CloudStorageService.batchSaveCustomers(json.customers);
            if (json.transactions) await CloudStorageService.batchAddTransactions(json.transactions);
            if (json.financeRecords) await CloudStorageService.batchAddFinanceRecords(json.financeRecords);

            alert('云端数据恢复成功！请刷新页面。');
            onDataRestored();
          } else {
            alert('数据格式错误，恢复失败。');
          }
        }
      } catch (err) {
        console.error(err);
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

      {/* Sync mechanism removed since we are now cloud-native */}

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
            <br />建议定期备份以防设备丢失或清理缓存导致数据丢失。
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
            <AlertTriangle size={16} className="mr-2 mt-0.5 shrink-0" />
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
        <p>贵蓁供销存 v3.0.0 (Netlify Cloud)</p>
        <p className="mt-1 opacity-60">数据由 Netlify Blobs 强力驱动</p>
      </div>
    </div>
  );
};

export default Settings;