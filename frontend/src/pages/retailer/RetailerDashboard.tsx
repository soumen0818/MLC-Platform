import { useAuthStore } from '@/stores/authStore';
import { formatCurrency } from '@/lib/utils';
import { StatusPill } from '@/components/ui';
import { Wallet, TrendingUp, Smartphone, ArrowUpRight, Zap, CreditCard, Inbox } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';

const weekData: any[] = [];
const transactions: any[] = [];

export default function RetailerDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const stats = {
    walletBalance: user?.walletBalance || '0.00',
    todayRecharges: 0,
    todayRechargeAmount: '0.00',
    todayCommission: '0.00',
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Dashboard</h1>
        <p className="text-[14px] text-text-secondary mt-1">Welcome, {user?.name}. Here's your quick overview.</p>
      </div>

      {/* Wallet Hero */}
      <div className="card-gradient p-7 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <Wallet size={16} className="text-white/70" />
            <span className="text-[12px] text-white/70 font-medium">Wallet Balance</span>
          </div>
          <p className="text-[32px] font-bold text-white mb-4 font-mono">
            {formatCurrency(stats.walletBalance)}
          </p>
          <div className="flex gap-2.5">
            <button onClick={() => navigate('/retailer/topup')} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-none bg-white text-black text-[13px] font-semibold cursor-pointer shadow-sm hover:bg-gray-50 transition-colors">
              <ArrowUpRight size={15} /> Request Top-up
            </button>
            <button onClick={() => navigate('/retailer/withdraw')} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/20 bg-white/15 text-white text-[13px] font-semibold cursor-pointer hover:bg-white/25 transition-colors">
              <CreditCard size={15} /> Withdraw
            </button>
          </div>
        </div>
        <div className="absolute -top-5 -right-2.5 w-[120px] h-[120px] rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-[38px] h-[38px] rounded-xl bg-emerald-50 flex items-center justify-center">
              <Smartphone size={18} className="text-emerald-600" />
            </div>
            <span className="text-[13px] text-text-secondary">Today's Recharges</span>
          </div>
          <p className="text-[22px] font-bold text-text-primary m-0 font-mono">{stats.todayRecharges}</p>
          <p className="text-[11px] text-text-muted mt-1">{formatCurrency(stats.todayRechargeAmount)} volume</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-[38px] h-[38px] rounded-xl bg-violet-50 flex items-center justify-center">
              <TrendingUp size={18} className="text-violet-600" />
            </div>
            <span className="text-[13px] text-text-secondary">Commission Earned</span>
          </div>
          <p className="text-[22px] font-bold text-emerald-500 m-0 font-mono">{formatCurrency(stats.todayCommission)}</p>
          <p className="text-[11px] text-text-muted mt-1">Today</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-[38px] h-[38px] rounded-xl bg-blue-50 flex items-center justify-center">
              <Zap size={18} className="text-blue-600" />
            </div>
            <span className="text-[13px] text-text-secondary">Quick Recharge</span>
          </div>
          <button onClick={() => navigate('/retailer/recharge')} className="flex items-center justify-center gap-1.5 w-full p-2.5 rounded-xl border-none bg-black text-white text-[13px] font-semibold cursor-pointer mt-1.5 hover:bg-black/90 transition-colors">
            <Smartphone size={14} /> New Recharge
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="card p-6">
        <h3 className="text-[15px] font-semibold text-text-primary mb-4">Weekly Activity</h3>
        {weekData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weekData}>
              <defs>
                <linearGradient id="colorRecharges" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2D5BE3" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#2D5BE3" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
              <XAxis dataKey="name" stroke="#52525B" fontSize={11} axisLine={false} tickLine={false} />
              <YAxis stroke="#52525B" fontSize={11} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0A0A0A', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '12px' }} />
              <Area type="monotone" dataKey="recharges" stroke="#2D5BE3" strokeWidth={2} fill="url(#colorRecharges)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex flex-col items-center justify-center text-text-muted bg-background rounded-xl">
            <Inbox size={32} className="mb-2 opacity-50" />
            <p className="text-[13px] font-medium m-0">No data available for charts</p>
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="text-[15px] font-semibold text-text-primary m-0">Recent Transactions</h3>
          <button onClick={() => navigate('/retailer/history')} className="text-[12px] font-semibold text-text-secondary bg-transparent border-none cursor-pointer hover:text-text-primary">View All</button>
        </div>
        
        {transactions.length > 0 ? transactions.map((txn, i) => (
          <div key={i} className={`flex items-center justify-between py-3 ${i < transactions.length - 1 ? 'border-b border-border' : ''}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-[38px] h-[38px] rounded-xl bg-background flex items-center justify-center">
                <Smartphone size={14} className="text-text-primary" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary m-0">{txn.number}</p>
                <p className="text-[11px] text-text-muted m-0">{txn.operator}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="text-right">
                <p className="text-[13px] font-bold text-text-primary font-mono m-0">{formatCurrency(txn.amount)}</p>
                {txn.commission > 0 && <p className="text-[11px] font-mono text-emerald-500 m-0">+{formatCurrency(txn.commission)}</p>}
              </div>
              <StatusPill status={txn.status} />
            </div>
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center py-8 text-text-muted border border-dashed border-border rounded-xl">
            <Inbox size={32} className="mb-2 opacity-50" />
            <p className="text-[13px] font-medium m-0">No recent transactions found</p>
          </div>
        )}
      </div>
    </div>
  );
}
