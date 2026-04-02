
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency } from '@/lib/utils';
import { StatusPill } from '@/components/ui';
import {
  Wallet,
  TrendingUp,
  Smartphone,
  ArrowUpRight,
  Zap,
  CreditCard,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const weekData = [
  { name: 'Mon', recharges: 12, amount: 4500 },
  { name: 'Tue', recharges: 18, amount: 7200 },
  { name: 'Wed', recharges: 15, amount: 5800 },
  { name: 'Thu', recharges: 22, amount: 9100 },
  { name: 'Fri', recharges: 19, amount: 7600 },
  { name: 'Sat', recharges: 27, amount: 11200 },
  { name: 'Sun', recharges: 14, amount: 5200 },
];

export default function RetailerDashboard() {
  const { user } = useAuthStore();

  const stats = {
    walletBalance: user?.walletBalance || '15000.00',
    todayRecharges: 23,
    todayRechargeAmount: '9450.00',
    todayCommission: '472.50',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display">Dashboard</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Welcome, {user?.name}. Here's your quick overview.
        </p>
      </div>

      {/* Wallet Card — Hero */}
      <div className="card-gradient p-6 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={18} className="text-white/70" />
            <span className="text-sm text-white/70 font-medium">Wallet Balance</span>
          </div>
          <p className="text-4xl font-bold font-mono text-white mb-4">
            {formatCurrency(stats.walletBalance)}
          </p>
          <div className="flex gap-3">
            <button className="btn bg-white text-[var(--color-primary)] hover:bg-white/90 text-sm py-2 px-5">
              <ArrowUpRight size={16} />
              Request Top-up
            </button>
            <button className="btn bg-white/20 text-white hover:bg-white/30 text-sm py-2 px-5">
              <CreditCard size={16} />
              Withdraw
            </button>
          </div>
        </div>
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 right-20 w-24 h-24 bg-white/5 rounded-full translate-y-1/3" />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <Smartphone size={20} className="text-green-600" />
            </div>
            <span className="text-sm text-[var(--color-text-secondary)]">Today's Recharges</span>
          </div>
          <p className="text-2xl font-bold font-mono">{stats.todayRecharges}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{formatCurrency(stats.todayRechargeAmount)} volume</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <TrendingUp size={20} className="text-purple-600" />
            </div>
            <span className="text-sm text-[var(--color-text-secondary)]">Commission Earned</span>
          </div>
          <p className="text-2xl font-bold font-mono text-[var(--color-success)]">
            {formatCurrency(stats.todayCommission)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Today</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Zap size={20} className="text-blue-600" />
            </div>
            <span className="text-sm text-[var(--color-text-secondary)]">Quick Recharge</span>
          </div>
          <button className="btn btn-primary btn-sm w-full mt-2">
            <Smartphone size={16} />
            New Recharge
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="card p-6">
        <h3 className="font-semibold mb-4">Weekly Activity</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={weekData}>
            <defs>
              <linearGradient id="colorRecharges" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2D5BE3" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#2D5BE3" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF5" />
            <XAxis dataKey="name" stroke="#636E86" fontSize={12} />
            <YAxis stroke="#636E86" fontSize={12} />
            <Tooltip
              contentStyle={{
                background: 'white',
                border: '1px solid #E8EDF5',
                borderRadius: '12px',
              }}
            />
            <Area type="monotone" dataKey="recharges" stroke="#2D5BE3" strokeWidth={2} fill="url(#colorRecharges)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Transactions */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Recent Transactions</h3>
          <button className="btn btn-ghost btn-sm">View All</button>
        </div>
        <div className="space-y-3">
          {[
            { number: '98765xxxxx', operator: 'Jio', amount: 399, status: 'SUCCESS', commission: 7.98 },
            { number: '87654xxxxx', operator: 'Airtel', amount: 199, status: 'SUCCESS', commission: 3.98 },
            { number: '76543xxxxx', operator: 'Vi', amount: 49, status: 'PENDING', commission: 0 },
            { number: '65432xxxxx', operator: 'BSNL', amount: 99, status: 'FAILED', commission: 0 },
            { number: '54321xxxxx', operator: 'Jio', amount: 599, status: 'SUCCESS', commission: 11.98 },
          ].map((txn, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-[var(--color-border)] last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-card)] flex items-center justify-center">
                  <Smartphone size={16} className="text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-sm font-medium">{txn.number}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{txn.operator}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold font-mono">{formatCurrency(txn.amount)}</p>
                {txn.commission > 0 && (
                  <p className="text-xs text-[var(--color-success)] font-mono">+{formatCurrency(txn.commission)}</p>
                )}
              </div>
              <StatusPill status={txn.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
