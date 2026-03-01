import React, { useState, useMemo, useRef } from 'react';
import { Customer, ProductType, CustomerCard, Transaction } from '../types';
import { CloudStorageService } from '../services/cloudStorage';
import { Search, Plus, User, Phone, Edit2, Trash2, CreditCard, Clock, CheckCircle, XCircle, MinusCircle, AlertTriangle, Smartphone, UserMinus, BatteryWarning, Download, Upload, ShoppingBag, Calendar } from 'lucide-react';
import { exportToCSV, parseCSV } from '../utils/csvExport';

interface CustomersProps {
    customers: Customer[];
    transactions: Transaction[];
    onUpdate: () => void;
}

const Customers: React.FC<CustomersProps> = ({ customers, transactions, onUpdate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'ALL' | 'LOW_BALANCE' | 'DORMANT'>('ALL');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Edit Customer Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [formData, setFormData] = useState<Partial<Customer>>({ name: '', phone: '', notes: '' });

    // View/Redeem State
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    // Redeem Confirmation Modal State
    const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
    const [redeemTarget, setRedeemTarget] = useState<{ cardId: string, max: number, name: string } | null>(null);
    const [redeemCount, setRedeemCount] = useState(1);

    // --- Insight Logic ---
    const insightStats = useMemo(() => {
        let lowBalanceCount = 0;
        let dormantCount = 0;
        const now = new Date();

        customers.forEach(c => {
            // Check Low Balance: Has at least one count card with < 2 remaining and not expired
            const hasLowBalance = c.cards.some(card =>
                card.type === ProductType.SERVICE_COUNT &&
                (card.remainingCounts || 0) < 2 &&
                (card.remainingCounts || 0) > 0
            );
            if (hasLowBalance) lowBalanceCount++;

            // Check Dormant: Last activity > 30 days ago OR no activity ever (but created > 30 days ago? simplified to no activity)
            const lastActive = c.lastActivity ? new Date(c.lastActivity) : null;
            if (lastActive) {
                const diffDays = Math.ceil((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays > 30) dormantCount++;
            } else {
                // If never active, treat as dormant if they have cards (bought long time ago but never used? logic simplifies here)
                if (c.cards.length > 0) dormantCount++;
            }
        });

        return { lowBalanceCount, dormantCount, total: customers.length };
    }, [customers]);

    // Filter Logic with Insights
    const filteredCustomers = customers.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm);
        if (!matchesSearch) return false;

        if (filterType === 'LOW_BALANCE') {
            return c.cards.some(card =>
                card.type === ProductType.SERVICE_COUNT && (card.remainingCounts || 0) < 2 && (card.remainingCounts || 0) > 0
            );
        }
        if (filterType === 'DORMANT') {
            const lastActive = c.lastActivity ? new Date(c.lastActivity) : null;
            if (!lastActive) return c.cards.length > 0;
            const diffDays = Math.ceil((new Date().getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
            return diffDays > 30;
        }
        return true;
    });

    // Get History for Selected Customer
    const selectedCustomerHistory = useMemo(() => {
        if (!selectedCustomer) return [];
        // Filter transactions linked by ID
        // Fallback: match by name if ID is missing (legacy data support)
        return transactions.filter(t =>
            (t.partyId === selectedCustomer.id) ||
            (!t.partyId && t.partyName === selectedCustomer.name)
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [selectedCustomer, transactions]);

    // --- Helper to check status for specific customer rendering ---
    const getCustomerStatus = (c: Customer) => {
        const isLowBalance = c.cards.some(card =>
            card.type === ProductType.SERVICE_COUNT && (card.remainingCounts || 0) < 2 && (card.remainingCounts || 0) > 0
        );

        const lastActive = c.lastActivity ? new Date(c.lastActivity) : null;
        let isDormant = false;
        if (lastActive) {
            const diffDays = Math.ceil((new Date().getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > 30) isDormant = true;
        } else if (c.cards.length > 0) {
            isDormant = true;
        }

        return { isLowBalance, isDormant };
    };

    const handleExport = () => {
        const dataToExport = filteredCustomers.map(c => ({
            name: c.name,
            phone: c.phone,
            notes: c.notes,
            lastActivity: c.lastActivity ? new Date(c.lastActivity).toLocaleDateString() : '无记录',
            assetsCount: c.cards.length
        }));

        const headers = [
            { key: 'name', label: '客户姓名' },
            { key: 'phone', label: '手机号' },
            { key: 'notes', label: '备注' },
            { key: 'assetsCount', label: '持有卡项数' },
            { key: 'lastActivity', label: '最后活动时间' },
        ];

        exportToCSV(dataToExport, headers, '客户列表');
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

                const newCustomers: Customer[] = parsed.map((row: any) => ({
                    id: Date.now().toString() + Math.random().toString().slice(2, 6),
                    name: row['客户姓名'] || row['name'] || '未知客户',
                    phone: row['手机号'] || row['phone'] || '',
                    notes: row['备注'] || row['notes'] || '',
                    cards: [],
                    lastActivity: new Date().toISOString()
                }));

                if (confirm(`解析到 ${newCustomers.length} 条客户数据，确定导入吗？`)) {
                    // Use Batch Save
                    CloudStorageService.batchSaveCustomers(newCustomers).then(() => {
                        onUpdate();
                        alert('导入成功');
                    });
                }
            } catch (err) {
                console.error(err);
                alert('导入失败，请检查文件格式。');
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };


    // CRUD Handlers
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const newCustomer: Customer = {
            id: editingCustomer ? editingCustomer.id : Date.now().toString(),
            name: formData.name || '新客户',
            phone: formData.phone || '',
            notes: formData.notes || '',
            cards: editingCustomer ? editingCustomer.cards : [],
            lastActivity: editingCustomer?.lastActivity || new Date().toISOString()
        };
        await CloudStorageService.saveCustomer(newCustomer);
        onUpdate();
        closeModal();
    };

    const deleteCustomer = async (id: string) => {
        if (confirm('删除客户将同时删除其所有卡项资产，确认删除？')) {
            await CloudStorageService.deleteCustomer(id);
            onUpdate();
            if (selectedCustomer?.id === id) setSelectedCustomer(null);
        }
    };

    // --- SMS Logic ---
    const sendSMS = (customer: Customer, productName: string, type: ProductType, changeAmount: number, remaining: number | string) => {
        if (!customer.phone) return;

        const dateStr = new Date().toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        let message = `【贵蓁供销存】尊敬的${customer.name}，您于${dateStr}核销了“${productName}”`;

        if (type === ProductType.SERVICE_COUNT) {
            message += ` ${changeAmount}次，剩余 ${remaining} 次。感谢您的光临！`;
        } else {
            message += `。当前会员有效期至：${remaining}。感谢您的光临！`;
        }

        const ua = navigator.userAgent.toLowerCase();
        const separator = (ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1) ? '&' : '?';
        window.location.href = `sms:${customer.phone}${separator}body=${encodeURIComponent(message)}`;
    };

    // --- Redemption Logic ---
    const initiateRedeem = (card: CustomerCard) => {
        setRedeemTarget({
            cardId: card.id,
            max: card.remainingCounts || 9999,
            name: card.productName
        });
        setRedeemCount(1);
        setIsRedeemModalOpen(true);
    };

    const confirmRedeem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCustomer || !redeemTarget) return;

        const card = selectedCustomer.cards.find(c => c.id === redeemTarget.cardId);
        if (!card) return;

        const success = await CloudStorageService.redeemCard(selectedCustomer.id, redeemTarget.cardId, redeemCount);

        if (success) {
            let remainingInfo: string | number = '';
            if (card.type === ProductType.SERVICE_COUNT) {
                remainingInfo = (card.remainingCounts || 0) - redeemCount;
            } else {
                remainingInfo = new Date(card.expiryDate!).toLocaleDateString();
            }

            if (selectedCustomer.phone) {
                setTimeout(() => {
                    if (confirm(`核销成功！是否给客户 ${selectedCustomer.name} 发送短信通知？`)) {
                        sendSMS(selectedCustomer, redeemTarget.name, card.type, redeemCount, remainingInfo);
                    }
                }, 100);
            } else {
                alert('核销成功！');
            }

            onUpdate();

            closeRedeemModal();
            // To update local selected view properly without refetching immediately
            setSelectedCustomer(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    cards: prev.cards.map(c =>
                        c.id === card.id
                            ? { ...c, remainingCounts: card.type === ProductType.SERVICE_COUNT ? ((c.remainingCounts || 0) - redeemCount) : c.remainingCounts }
                            : c
                    )
                };
            });
        } else {
            alert('核销失败：次数不足或已过期');
        }
    };

    const closeRedeemModal = () => {
        setIsRedeemModalOpen(false);
        setRedeemTarget(null);
        setRedeemCount(1);
    };

    // Modal Helpers
    const openModal = (customer?: Customer) => {
        if (customer) {
            setEditingCustomer(customer);
            setFormData(customer);
        } else {
            setEditingCustomer(null);
            setFormData({ name: '', phone: '', notes: '' });
        }
        setIsModalOpen(true);
    };
    const closeModal = () => setIsModalOpen(false);

    // -- Render Helper: Customer Card/Asset --
    const renderAsset = (card: CustomerCard) => {
        const isCount = card.type === ProductType.SERVICE_COUNT;

        let expiryStatus = 'NORMAL';
        let daysLeft = 0;

        if (!isCount && card.expiryDate) {
            const now = new Date();
            const expiry = new Date(card.expiryDate);
            daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            if (daysLeft < 0) expiryStatus = 'EXPIRED';
            else if (daysLeft <= 7) expiryStatus = 'WARNING';
        }

        const isExpired = expiryStatus === 'EXPIRED';
        const isDepleted = isCount && (card.remainingCounts || 0) <= 0;
        const isLowCount = isCount && !isDepleted && (card.remainingCounts || 0) < 2;

        return (
            <div key={card.id} className={`p-4 rounded-xl border mb-3 flex justify-between items-center transition-all ${isExpired || isDepleted
                    ? 'bg-slate-100 border-slate-200 opacity-60'
                    : expiryStatus === 'WARNING'
                        ? 'bg-orange-50 border-orange-200 shadow-sm'
                        : 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100'
                }`}>
                <div>
                    <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-slate-800">{card.productName}</h4>
                        {expiryStatus === 'WARNING' && (
                            <span className="flex items-center text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold animate-pulse">
                                <AlertTriangle size={10} className="mr-0.5" />
                                {daysLeft}天后过期
                            </span>
                        )}
                        {isLowCount && (
                            <span className="flex items-center text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">
                                <BatteryWarning size={10} className="mr-0.5" />
                                余量不足
                            </span>
                        )}
                    </div>

                    <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
                        <span>{new Date(card.purchaseDate).toLocaleDateString()} 购买</span>
                        {isExpired && <span className="text-red-500 font-bold">已过期</span>}
                        {isDepleted && <span className="text-red-500 font-bold">已用完</span>}
                    </div>
                </div>

                <div className="text-right">
                    {isCount ? (
                        <div className="flex flex-col items-end">
                            <span className={`text-2xl font-bold ${isLowCount ? 'text-red-600' : 'text-indigo-600'}`}>
                                {card.remainingCounts} <span className="text-sm text-slate-400">次</span>
                            </span>
                            {!isDepleted && (
                                <button onClick={() => initiateRedeem(card)} className="mt-1 px-3 py-1 bg-indigo-600 text-white text-xs rounded-full hover:bg-indigo-700 active:scale-95 transition-all shadow-sm flex items-center">
                                    <MinusCircle size={12} className="mr-1" /> 立即核销
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-end">
                            <span className="text-sm font-medium text-slate-600">有效期至</span>
                            <span className={`text-sm ${isExpired ? 'text-red-500' : expiryStatus === 'WARNING' ? 'text-orange-600 font-bold' : 'text-slate-800'}`}>
                                {new Date(card.expiryDate!).toLocaleDateString()}
                            </span>
                            {!isExpired && (
                                <button onClick={() => initiateRedeem(card)} className="text-xs text-green-600 flex items-center mt-1 border border-green-200 bg-green-50 px-2 py-0.5 rounded-full hover:bg-green-100">
                                    <CheckCircle size={10} className="mr-1" />
                                    {expiryStatus === 'WARNING' ? '立即签到' : '验卡签到'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-6">
            {/* Left List */}
            <div className={`lg:w-1/3 flex flex-col h-full ${selectedCustomer ? 'hidden lg:flex' : 'flex'}`}>

                {/* Header & Stats Cards */}
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-800">客户列表</h2>
                        <div className="flex space-x-2">
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
                                title="导入客户"
                            >
                                <Upload size={20} />
                            </button>
                            <button
                                onClick={handleExport}
                                className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                                title="导出客户列表"
                            >
                                <Download size={20} />
                            </button>
                            <button onClick={() => openModal()} className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700"><Plus size={20} /></button>
                        </div>
                    </div>

                    {/* Insight Cards */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div
                            onClick={() => setFilterType(filterType === 'LOW_BALANCE' ? 'ALL' : 'LOW_BALANCE')}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${filterType === 'LOW_BALANCE' ? 'bg-red-50 border-red-500 ring-1 ring-red-500' : 'bg-white border-slate-200 hover:border-red-300'}`}
                        >
                            <div className="flex items-center space-x-2 text-red-600 mb-1">
                                <BatteryWarning size={16} />
                                <span className="text-xs font-bold">余量告急</span>
                            </div>
                            <div className="text-xl font-bold text-slate-800">{insightStats.lowBalanceCount} <span className="text-xs text-slate-400 font-normal">人</span></div>
                        </div>

                        <div
                            onClick={() => setFilterType(filterType === 'DORMANT' ? 'ALL' : 'DORMANT')}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${filterType === 'DORMANT' ? 'bg-slate-100 border-slate-500 ring-1 ring-slate-500' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                        >
                            <div className="flex items-center space-x-2 text-slate-500 mb-1">
                                <UserMinus size={16} />
                                <span className="text-xs font-bold">沉睡客户</span>
                            </div>
                            <div className="text-xl font-bold text-slate-800">{insightStats.dormantCount} <span className="text-xs text-slate-400 font-normal">人</span></div>
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="搜索姓名或手机..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        {filterType !== 'ALL' && (
                            <button onClick={() => setFilterType('ALL')} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-slate-200 px-2 py-0.5 rounded-full text-slate-600">
                                清除筛选
                            </button>
                        )}
                    </div>
                </div>

                {/* List Area */}
                <div className="flex-1 overflow-y-auto space-y-2 pb-20 lg:pb-0 pr-1">
                    {filteredCustomers.map(c => {
                        const status = getCustomerStatus(c);
                        return (
                            <div
                                key={c.id}
                                onClick={() => setSelectedCustomer(c)}
                                className={`p-4 bg-white rounded-xl border cursor-pointer transition-all hover:shadow-md relative overflow-hidden 
                            ${selectedCustomer?.id === c.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'}
                            ${status.isLowBalance ? 'border-l-4 border-l-red-500' : ''}
                        `}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold
                                    ${status.isDormant ? 'bg-slate-300' : 'bg-indigo-600'}
                                `}>
                                            {c.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="flex items-center">
                                                <h3 className={`font-bold ${status.isDormant ? 'text-slate-500' : 'text-slate-800'}`}>{c.name}</h3>
                                                {status.isLowBalance && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">需充值</span>}
                                                {status.isDormant && <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">久未到店</span>}
                                            </div>
                                            <p className="text-xs text-slate-400 flex items-center mt-0.5"><Phone size={10} className="mr-1" /> {c.phone}</p>
                                        </div>
                                    </div>
                                    {c.cards.length > 0 && (
                                        <span className="bg-slate-50 text-slate-500 text-xs px-2 py-0.5 rounded-full font-medium border border-slate-100">
                                            {c.cards.length} 项
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {filteredCustomers.length === 0 && <div className="text-center text-slate-400 py-10">无匹配客户</div>}
                </div>
            </div>

            {/* Right Detail / Asset View */}
            <div className={`lg:w-2/3 bg-white lg:rounded-2xl lg:shadow-sm lg:border lg:border-slate-200 flex flex-col ${selectedCustomer ? 'fixed inset-0 z-50 lg:static' : 'hidden lg:flex lg:items-center lg:justify-center'}`}>
                {selectedCustomer ? (
                    <>
                        {/* Mobile Header */}
                        <div className="lg:hidden p-4 border-b border-slate-100 flex items-center space-x-3 bg-white">
                            <button onClick={() => setSelectedCustomer(null)} className="text-slate-500">
                                <XCircle size={24} />
                            </button>
                            <h2 className="text-lg font-bold">客户详情</h2>
                        </div>

                        <div className="p-6 border-b border-slate-100 bg-slate-50 lg:rounded-t-2xl">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">{selectedCustomer.name}</h2>
                                    <p className="text-slate-500 text-sm mt-1 flex items-center">
                                        <Phone size={14} className="mr-1" />
                                        {selectedCustomer.phone}
                                        {selectedCustomer.phone && <a href={`tel:${selectedCustomer.phone}`} className="ml-2 text-indigo-600 text-xs border border-indigo-200 px-2 py-0.5 rounded-full">拨打</a>}
                                    </p>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {selectedCustomer.notes && <p className="text-slate-400 text-xs bg-white inline-block px-2 py-1 rounded border border-slate-100">{selectedCustomer.notes}</p>}
                                        {getCustomerStatus(selectedCustomer).isDormant && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded">超过30天未活跃</span>}
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    <button onClick={() => openModal(selectedCustomer)} className="p-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"><Edit2 size={18} /></button>
                                    <button onClick={() => deleteCustomer(selectedCustomer.id)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-white lg:rounded-b-2xl">
                            {/* Assets Section */}
                            <div className="mb-8">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                                    <CreditCard size={20} className="mr-2 text-indigo-500" />
                                    资产与卡包
                                </h3>

                                {selectedCustomer.cards.length === 0 ? (
                                    <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <Clock size={24} className="mx-auto text-slate-300 mb-2" />
                                        <p className="text-slate-500 text-sm">暂无已购买的卡项或服务</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {selectedCustomer.cards.map(renderAsset)}
                                    </div>
                                )}
                            </div>

                            {/* History Section */}
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                                    <ShoppingBag size={20} className="mr-2 text-indigo-500" />
                                    消费记录
                                </h3>
                                {selectedCustomerHistory.length === 0 ? (
                                    <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <Calendar size={24} className="mx-auto text-slate-300 mb-2" />
                                        <p className="text-slate-500 text-sm">暂无历史消费记录</p>
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-100 text-slate-500 font-medium">
                                                <tr>
                                                    <th className="px-4 py-3">时间</th>
                                                    <th className="px-4 py-3">商品/项目</th>
                                                    <th className="px-4 py-3 text-right">金额</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {selectedCustomerHistory.map(t => (
                                                    <tr key={t.id} className="hover:bg-slate-100 transition-colors">
                                                        <td className="px-4 py-3 text-slate-500 text-xs">
                                                            {new Date(t.date).toLocaleDateString()} <br />
                                                            {new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="font-bold text-slate-700">{t.productName}</div>
                                                            <div className="text-xs text-slate-400">数量: {t.quantity}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                                                            ¥{t.totalAmount}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-center text-slate-400">
                        <User size={48} className="mx-auto mb-4 opacity-20" />
                        <p>请选择一个客户查看详情与核销</p>
                    </div>
                )}
            </div>

            {/* Edit/Add Customer Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-md shadow-2xl p-6">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">{editingCustomer ? '编辑客户' : '添加新客户'}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">姓名</label>
                                <input required className="w-full border rounded-lg p-2.5" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">手机号</label>
                                <input className="w-full border rounded-lg p-2.5" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">备注</label>
                                <textarea className="w-full border rounded-lg p-2.5" rows={3} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button type="button" onClick={closeModal} className="px-4 py-2 text-slate-600">取消</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg">保存</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Redeem Confirmation Modal */}
            {isRedeemModalOpen && redeemTarget && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 transform transition-all scale-100">
                        <div className="text-center mb-6">
                            <div className="mx-auto w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                                <MinusCircle size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">核销 / 签到确认</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                正在为 <span className="font-medium text-slate-800">{selectedCustomer?.name}</span> 核销
                                <br />
                                <span className="font-bold text-indigo-600">{redeemTarget.name}</span>
                            </p>
                        </div>

                        <form onSubmit={confirmRedeem}>
                            {/* Only show quantity picker for Count Cards, effectively for Time Cards it's usually just '1 visit' or 'verification' */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-sm font-medium text-slate-600">核销数量</label>
                                    <span className="text-xs text-slate-400">
                                        {redeemTarget.max > 9000 ? '期限卡(无限次)' : `剩余可用: ${redeemTarget.max}`}
                                    </span>
                                </div>
                                <div className="flex items-center">
                                    <button
                                        type="button"
                                        onClick={() => setRedeemCount(Math.max(1, redeemCount - 1))}
                                        className="w-10 h-10 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-600 active:bg-slate-100"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        min="1"
                                        max={redeemTarget.max > 9000 ? 99 : redeemTarget.max}
                                        className="flex-1 mx-2 text-center text-xl font-bold border border-slate-300 rounded-lg h-10"
                                        value={redeemCount}
                                        onChange={e => setRedeemCount(Math.max(1, parseInt(e.target.value) || 0))}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setRedeemCount(redeemTarget.max > 9000 ? redeemCount + 1 : Math.min(redeemTarget.max, redeemCount + 1))}
                                        className="w-10 h-10 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-600 active:bg-slate-100"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {selectedCustomer?.phone && (
                                <div className="flex items-center justify-center mb-6 text-xs text-slate-500 bg-indigo-50 py-2 rounded-lg border border-indigo-100">
                                    <Smartphone size={14} className="mr-1 text-indigo-500" />
                                    核销后将自动调起短信通知
                                </div>
                            )}

                            <div className="flex space-x-3">
                                <button type="button" onClick={closeRedeemModal} className="flex-1 py-3 text-slate-600 font-medium bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                                    取消
                                </button>
                                <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-transform active:scale-95">
                                    确认核销
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Customers;