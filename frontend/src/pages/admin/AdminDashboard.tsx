import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency } from '@/lib/utils';
import { StatusPill, LoadingSpinner } from '@/components/ui';
import api from '@/lib/api';
import type { DashboardStats } from '@/types';
import {
  Users,
  TrendingUp,
  Smartphone,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

// Demo chart data
const rechargeData = [
  { name: 'Mon', amount: 45000, commissions: 2200 },
  { name: 'Tue', amount: 52000, commissions: 2600 },
  { name: 'Wed', amount: 48000, commissions: 2400 },
  { name: 'Thu', amount: 61000, commissions: 3100 },
  { name: 'Fri', amount: 55000, commissions: 2800 },
  { name: 'Sat', amount: 67000, commissions: 3400 },
  { name: 'Sun', amount: 43000, commissions: 2100 },
];

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/reports/dashboard-stats');
      setStats(data);
    } catch (error) {
      // Use demo data if API fails
      setStats({
        totalUsers: 1247,
        activeUsers: 1089,
        todayRecharges: 3456,
        todayRechargeAmount: '1850000.00',
        todayCommissionsPaid: '92500.00',
        pendingWithdrawals: 23,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;

  const kpiCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers?.toLocaleString() || '0',
      subtitle: `${stats?.activeUsers || 0} active`,
      icon: <Users size={24} />,
      color: '#000000',
      bg: '#E4E4E7', // zinc-200
      trend: '+12%',
      trendUp: true,
    },
    {
      title: "Today's Recharges",
      value: stats?.todayRecharges?.toLocaleString() || '0',
      subtitle: formatCurrency(stats?.todayRechargeAmount || '0'),
      icon: <Smartphone size={24} />,
      color: '#000000',
      bg: '#CCFF00', // Lime Green
      trend: '+8%',
      trendUp: true,
    },
    {
      title: 'Commission Paid Today',
      value: formatCurrency(stats?.todayCommissionsPaid || '0'),
      subtitle: 'Distributed to network',
      icon: <TrendingUp size={24} />,
      color: '#000000',
      bg: '#D4D4D8', // zinc-300
      trend: '+5%',
      trendUp: true,
    },
    {
      title: 'Pending Withdrawals',
      value: stats?.pendingWithdrawals?.toString() || '0',
      subtitle: 'Require processing',
      icon: <AlertCircle size={24} />,
      color: '#FFFFFF',
      bg: '#0A0A0A', // Black
      trend: '3 urgent',
      trendUp: false,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold font-display text-[var(--color-text-primary)]">
          Dashboard
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Welcome back, {user?.name}. Here's your platform overview.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => (
          <div
            key={card.title}
            className="card p-5"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: card.bg, color: card.color }}
              >
                {card.icon}
              </div>
              <div
                className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                  card.trendUp
                    ? 'bg-green-50 text-green-600'
                    : 'bg-amber-50 text-amber-600'
                }`}
              >
                {card.trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {card.trend}
              </div>
            </div>
            <p className="text-2xl font-bold font-mono text-[var(--color-text-primary)]">
              {card.value}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">{card.subtitle}</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-3 font-medium uppercase tracking-wider">
              {card.title}
            </p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-[var(--color-text-primary)]">Recharge Volume</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">Last 7 days</p>
            </div>
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-[var(--color-primary)]" />
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Live</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={rechargeData}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#CCFF00" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#CCFF00" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
              <XAxis dataKey="name" stroke="#52525B" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
              <YAxis stroke="#52525B" fontSize={12} tickFormatter={(v) => `₹${v / 1000}K`} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: '#0A0A0A',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#fff',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                }}
                itemStyle={{ color: '#CCFF00' }}
                formatter={(value: number) => [formatCurrency(value), 'Volume']}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#0A0A0A"
                strokeWidth={3}
                fill="url(#colorAmount)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Commission Chart */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-[var(--color-text-primary)]">Commission Distribution</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">Last 7 days</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={rechargeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
              <XAxis dataKey="name" stroke="#52525B" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
              <YAxis stroke="#52525B" fontSize={12} tickFormatter={(v) => `₹${v / 1000}K`} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: '#0A0A0A',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#fff',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                }}
                itemStyle={{ color: '#CCFF00' }}
                formatter={(value: number) => [formatCurrency(value), 'Commissions']}
              />
              <Line
                type="monotone"
                dataKey="commissions"
                stroke="#CCFF00"
                strokeWidth={3}
                dot={{ fill: '#0A0A0A', r: 4, strokeWidth: 2, stroke: '#CCFF00' }}
                activeDot={{ r: 6, fill: '#CCFF00', stroke: '#000', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--color-text-primary)]">Recent Transactions</h3>
            <button className="btn btn-ghost btn-sm">View All</button>
          </div>
          <div className="space-y-3">
            {[
              { number: '98765xxxxx', operator: 'Jio', amount: 399, status: 'SUCCESS', time: '2 min ago' },
              { number: '87654xxxxx', operator: 'Airtel', amount: 199, status: 'SUCCESS', time: '5 min ago' },
              { number: '76543xxxxx', operator: 'Vi', amount: 599, status: 'PENDING', time: '8 min ago' },
              { number: '65432xxxxx', operator: 'BSNL', amount: 99, status: 'FAILED', time: '12 min ago' },
              { number: '54321xxxxx', operator: 'Jio', amount: 249, status: 'SUCCESS', time: '15 min ago' },
            ].map((txn, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-[var(--color-border)] last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-card)] flex items-center justify-center">
                    <Smartphone size={18} className="text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{txn.number}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{txn.operator} • {txn.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold font-mono">{formatCurrency(txn.amount)}</span>
                  <StatusPill status={txn.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card p-6">
          <h3 className="font-semibold text-[var(--color-text-primary)] mb-4">Quick Actions</h3>
          <div className="space-y-3">
            {[
              { label: 'Create User', desc: 'Add a new user to the network', color: 'var(--color-primary)' },
              { label: 'Process Withdrawals', desc: `${stats?.pendingWithdrawals || 0} pending requests`, color: 'var(--color-warning)' },
              { label: 'Review KYC', desc: 'Pending document reviews', color: 'var(--color-secondary)' },
              { label: 'Export Reports', desc: 'Download daily summary CSV', color: 'var(--color-success)' },
            ].map((action, i) => (
              <button
                key={i}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--color-bg-card)] transition-colors text-left"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: action.color }}
                />
                <div>
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{action.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Network Health */}
          <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Network Health</h4>
            {[
              { role: 'State Heads', count: 12, color: '#6C4FD4' },
              { role: 'Master Distributors', count: 48, color: '#00CEFF' },
              { role: 'Distributors', count: 156, color: '#00B894' },
              { role: 'Retailers', count: 1031, color: '#FFA502' },
            ].map((level) => (
              <div key={level.role} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: level.color }} />
                  <span className="text-xs text-[var(--color-text-secondary)]">{level.role}</span>
                </div>
                <span className="text-sm font-bold font-mono">{level.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
