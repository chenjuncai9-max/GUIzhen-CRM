import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore
import { Peer } from "peerjs";
// @ts-ignore
import { Html5Qrcode } from "html5-qrcode";
import { StorageService } from '../services/storage';
import { Smartphone, ArrowRightLeft, QrCode, ScanLine, CheckCircle2, Loader2, AlertCircle, X } from 'lucide-react';

interface DataSyncProps {
  onClose: () => void;
  onSyncComplete: () => void;
}

const DataSync: React.FC<DataSyncProps> = ({ onClose, onSyncComplete }) => {
  const [mode, setMode] = useState<'SELECT' | 'SENDER' | 'RECEIVER'>('SELECT');
  const [status, setStatus] = useState<string>('');
  const [peerId, setPeerId] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const peerRef = useRef<any>(null);
  const connRef = useRef<any>(null);
  
  // Scanner
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  useEffect(() => {
    return () => {
      // Cleanup
      if (connRef.current) connRef.current.close();
      if (peerRef.current) peerRef.current.destroy();
      stopScanning();
    };
  }, []);

  // --- SENDER LOGIC ---
  const startSender = () => {
    setMode('SENDER');
    setStatus('正在连接同步服务...');
    
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id: string) => {
      setPeerId(id);
      setStatus('等待接收方扫码...');
      addLog(`同步码已生成: ${id}`);
    });

    peer.on('connection', (conn: any) => {
      connRef.current = conn;
      setStatus('设备已连接，准备发送数据...');
      addLog('接收方已连接');

      conn.on('open', () => {
        addLog('开始发送数据...');
        const data = StorageService.getAllData();
        conn.send(data);
        setStatus('数据发送完毕！');
        addLog('数据已发送，等待接收方确认');
        
        setTimeout(() => {
           alert('同步成功！数据已发送至新设备。');
           onClose();
        }, 1000);
      });
    });

    peer.on('error', (err: any) => {
      setStatus('连接错误');
      addLog(`Error: ${err.type}`);
    });
  };

  // --- RECEIVER LOGIC ---
  const startReceiver = () => {
    setMode('RECEIVER');
    setStatus('请扫描发送方的二维码');
    startScanning();
  };

  const connectToSender = (senderId: string) => {
    stopScanning();
    setStatus(`正在连接到设备: ${senderId}...`);
    addLog('正在建立连接...');

    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', () => {
      const conn = peer.connect(senderId);
      connRef.current = conn;

      conn.on('open', () => {
        setStatus('已连接，正在接收数据...');
        addLog('连接成功，等待数据传输...');
      });

      conn.on('data', (data: any) => {
        addLog('收到数据包，正在解析...');
        try {
          // Validate data structure lightly
          if (data && data.products && data.transactions) {
             const success = StorageService.restoreData(data);
             if (success) {
               setStatus('同步成功！正在重启...');
               addLog('数据恢复成功');
               setTimeout(() => {
                 alert('数据同步完成，页面将自动刷新。');
                 onSyncComplete();
                 window.location.reload();
               }, 1000);
             } else {
               setStatus('数据格式错误');
               addLog('恢复失败：数据格式不符');
             }
          } else {
             throw new Error("Invalid data format");
          }
        } catch (e) {
          setStatus('数据接收失败');
          addLog('处理数据时出错');
          console.error(e);
        }
      });
    });

    peer.on('error', (err: any) => {
      setStatus('连接失败，请重试');
      addLog(`Error: ${err.type}`);
    });
  };

  // --- SCANNER LOGIC ---
  const startScanning = () => {
      setIsScanning(true);
      setTimeout(() => {
          if (!document.getElementById("reader-sync")) return;
          
          const html5QrCode = new Html5Qrcode("reader-sync");
          scannerRef.current = html5QrCode;
          
          html5QrCode.start(
              { facingMode: "environment" },
              { fps: 10, qrbox: { width: 250, height: 250 } },
              (decodedText: string) => {
                  connectToSender(decodedText);
              },
              () => {}
          ).catch((err: any) => {
              console.error(err);
              setStatus('无法启动相机');
          });
      }, 100);
  };

  const stopScanning = () => {
      if (scannerRef.current) {
          scannerRef.current.stop().then(() => {
              scannerRef.current?.clear();
              setIsScanning(false);
          }).catch(console.error);
      }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
           <div className="flex items-center space-x-2">
             <ArrowRightLeft className="text-indigo-600" />
             <h3 className="font-bold text-slate-800">设备间数据同步</h3>
           </div>
           <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full text-slate-500">
             <X size={24} />
           </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {mode === 'SELECT' && (
            <div className="space-y-6">
               <p className="text-slate-600 text-sm leading-relaxed text-center">
                 此功能可将您的数据从一台设备“克隆”到另一台设备。<br/>
                 <span className="text-orange-600 font-bold">注意：接收方设备上的现有数据将被覆盖。</span>
               </p>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                    onClick={startSender}
                    className="flex flex-col items-center justify-center p-6 border-2 border-indigo-100 bg-indigo-50 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all group"
                  >
                     <div className="w-12 h-12 bg-indigo-200 rounded-full flex items-center justify-center mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors text-indigo-700">
                       <QrCode size={24} />
                     </div>
                     <span className="font-bold text-slate-800">我是发送方</span>
                     <span className="text-xs text-slate-500 mt-1">旧设备 (有数据)</span>
                  </button>

                  <button 
                    onClick={startReceiver}
                    className="flex flex-col items-center justify-center p-6 border-2 border-emerald-100 bg-emerald-50 rounded-xl hover:border-emerald-500 hover:shadow-md transition-all group"
                  >
                     <div className="w-12 h-12 bg-emerald-200 rounded-full flex items-center justify-center mb-3 group-hover:bg-emerald-600 group-hover:text-white transition-colors text-emerald-700">
                       <ScanLine size={24} />
                     </div>
                     <span className="font-bold text-slate-800">我是接收方</span>
                     <span className="text-xs text-slate-500 mt-1">新设备 (空数据)</span>
                  </button>
               </div>
            </div>
          )}

          {mode === 'SENDER' && (
             <div className="flex flex-col items-center text-center space-y-6">
                {!peerId ? (
                   <div className="py-10">
                      <Loader2 size={40} className="animate-spin text-indigo-600 mx-auto mb-4" />
                      <p className="text-slate-500">{status}</p>
                   </div>
                ) : (
                   <>
                      <div>
                        <p className="text-sm text-slate-500 mb-4">请用<span className="font-bold text-slate-800">接收方设备</span>扫描此二维码</p>
                        <div className="p-4 bg-white border-2 border-slate-800 rounded-xl inline-block shadow-lg">
                           <img 
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${peerId}`} 
                              alt="Sync QR Code" 
                              className="w-48 h-48"
                           />
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 p-3 rounded-lg text-left text-xs font-mono text-slate-500 h-32 overflow-y-auto">
                         {logs.map((log, i) => <div key={i}>&gt; {log}</div>)}
                      </div>
                   </>
                )}
             </div>
          )}

          {mode === 'RECEIVER' && (
             <div className="flex flex-col items-center space-y-4">
                <div className="w-full relative bg-black rounded-xl overflow-hidden aspect-square max-w-sm">
                   {isScanning && <div id="reader-sync" className="w-full h-full"></div>}
                   {!isScanning && (
                      <div className="absolute inset-0 flex items-center justify-center text-white">
                        <Loader2 className="animate-spin mr-2"/> 连接中...
                      </div>
                   )}
                </div>
                <p className="text-slate-600 font-medium">{status}</p>
                <div className="w-full bg-slate-100 p-3 rounded-lg text-left text-xs font-mono text-slate-500 h-24 overflow-y-auto">
                    {logs.map((log, i) => <div key={i}>&gt; {log}</div>)}
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataSync;