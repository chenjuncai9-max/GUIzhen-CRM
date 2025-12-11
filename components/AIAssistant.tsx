import React, { useState, useEffect } from 'react';
import { Product, Transaction, AIAnalysisResult } from '../types';
import { GeminiService } from '../services/geminiService';
import { Sparkles, Send, Loader2, MessageSquare, FileText } from 'lucide-react';

interface AIAssistantProps {
  products: Product[];
  transactions: Transaction[];
}

const AIAssistant: React.FC<AIAssistantProps> = ({ products, transactions }) => {
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [mobileTab, setMobileTab] = useState<'report' | 'chat'>('report');
  
  // Chat state
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', text: string}[]>([
    { role: 'assistant', text: '你好！我是贵蓁助手。我可以帮你查库存、分析销售数据，或者回答关于供应链的问题。' }
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Generate context string for chat
  const contextData = `
    产品列表: ${JSON.stringify(products.map(p => ({name: p.name, stock: p.stock, price: p.price})))}
    最近交易: ${JSON.stringify(transactions.slice(0, 5))}
  `;

  // Auto-run analysis on mount
  useEffect(() => {
    const runAnalysis = async () => {
      setLoadingAnalysis(true);
      const result = await GeminiService.analyzeBusiness(products, transactions);
      setAnalysis(result);
      setLoadingAnalysis(false);
    };
    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsSending(true);

    const response = await GeminiService.chat(userMsg, contextData);
    
    setMessages(prev => [...prev, { role: 'assistant', text: response }]);
    setIsSending(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] lg:h-auto">
      
      {/* Mobile Tab Switcher */}
      <div className="lg:hidden flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-4 shrink-0">
         <button 
           onClick={() => setMobileTab('report')}
           className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center space-x-2 transition-all ${
             mobileTab === 'report' ? 'bg-slate-800 text-white shadow' : 'text-slate-500'
           }`}
         >
           <FileText size={16} />
           <span>经营简报</span>
         </button>
         <button 
           onClick={() => setMobileTab('chat')}
           className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center space-x-2 transition-all ${
             mobileTab === 'chat' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500'
           }`}
         >
           <MessageSquare size={16} />
           <span>AI 对话</span>
         </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        
        {/* Left Column: Analysis Report */}
        <div className={`${mobileTab === 'report' ? 'flex' : 'hidden'} lg:flex bg-gradient-to-br from-slate-800 to-indigo-900 rounded-xl shadow-lg text-white p-6 md:p-8 flex-col overflow-y-auto`}>
          <div className="flex items-center space-x-3 mb-6 shrink-0">
            <div className="bg-white/20 p-2 rounded-lg">
               <Sparkles className="text-yellow-300" size={24} />
            </div>
            <h2 className="text-xl md:text-2xl font-bold">智能经营简报</h2>
          </div>

          {loadingAnalysis ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 min-h-[200px]">
              <Loader2 className="animate-spin text-white/50" size={48} />
              <p className="text-white/70 animate-pulse">正在分析您的业务数据...</p>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in pb-4">
              <div className="bg-white/10 p-5 rounded-xl border border-white/20">
                <h3 className="text-lg font-semibold text-white/90 mb-2 flex items-center">
                  <FileText size={18} className="mr-2" /> 
                  业务综述
                </h3>
                <p className="text-base md:text-lg leading-relaxed font-light">{analysis?.summary}</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white/90 mb-4">行动建议</h3>
                <ul className="space-y-3">
                  {analysis?.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start bg-white/5 p-3 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                      <span className="flex-shrink-0 w-6 h-6 bg-yellow-400 text-slate-900 rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="text-white/90 text-sm md:text-base">{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="mt-auto text-xs text-white/40 pt-4 border-t border-white/10">
                分析基于 Gemini AI 模型生成，仅供参考。
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Chat Interface */}
        <div className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} lg:flex bg-white rounded-xl shadow-sm border border-slate-200 flex-col overflow-hidden h-full`}>
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
             <div className="flex items-center space-x-2">
               <MessageSquare size={18} className="text-indigo-600" />
               <h3 className="font-bold text-slate-700">贵蓁助手</h3>
             </div>
             <span className="text-[10px] md:text-xs text-slate-400 bg-slate-200 px-2 py-1 rounded-full">Gemini 2.5 Flash</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 min-h-0">
             {messages.map((msg, idx) => (
               <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[85%] md:max-w-[80%] rounded-2xl px-4 py-3 shadow-sm text-sm md:text-base ${
                   msg.role === 'user' 
                     ? 'bg-indigo-600 text-white rounded-tr-none' 
                     : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                 }`}>
                   <p className="whitespace-pre-wrap">{msg.text}</p>
                 </div>
               </div>
             ))}
             {isSending && (
               <div className="flex justify-start">
                 <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                   <Loader2 size={16} className="animate-spin text-slate-400" />
                 </div>
               </div>
             )}
          </div>

          <div className="p-3 md:p-4 bg-white border-t border-slate-100 shrink-0">
             <form onSubmit={handleSend} className="relative">
               <input 
                 type="text" 
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 placeholder="输入问题..."
                 className="w-full pl-4 pr-12 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm md:text-base"
                 disabled={isSending}
               />
               <button 
                 type="submit" 
                 disabled={!input.trim() || isSending}
                 className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
               >
                 <Send size={16} />
               </button>
             </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;