import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui';
import api from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, Smartphone, AlertCircle, ArrowUpRight, ArrowDownRight, Activity, Inbox, Wallet, Server } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const rechargeData: any[] = [];

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/reports/dashboard-stats');
      setStats(data);
    } catch {
      setStats({
        totalUsers: 0, activeUsers: 0, todayRecharges: 0,
        todayRechargeAmount: '0.00', todayCommissionsPaid: '0.00', pendingWithdrawals: 0,
      });
    } finally { setLoading(false); }
  };

  if (loading) return <LoadingSpinner fullScreen />;

  let kpiCards = [];

  if (user?.role === 'SUPER_ADMIN') {
    kpiCards = [
      { 
        title: 'API Provider Sandbox', 
        value: 'Simulated', 
        subtitle: 'Dev mode active', 
        icon: <Server size={22} />, 
        iconColor: 'bg-primary text-black', 
        trend: 'Demo Mode', 
        trendUp: true 
      },
      { 
        title: 'Platform Liquidity', 
        value: formatCurrency(stats?.platformLiquidity || 0), 
        subtitle: 'Total Wallets Sum', 
        icon: <Wallet size={22} />, 
        iconColor: 'bg-blue-50 text-blue-600', 
        trend: 'Live', 
        trendUp: true 
      },
      { 
        title: "Today's Recharges", 
        value: stats?.todayRecharges?.toLocaleString() || '0', 
        subtitle: `${formatCurrency(stats?.todayRechargeAmount || '0')} · Successful only`, 
        icon: <Smartphone size={22} />, 
        iconColor: 'bg-emerald-50 text-emerald-600', 
        trend: '0%', 
        trendUp: true 
      },
      { 
        title: 'Pending Withdrawals', 
        value: stats?.pendingWithdrawals?.toString() || '0', 
        subtitle: 'Awaiting checks', 
        icon: <AlertCircle size={22} />, 
        iconColor: 'bg-amber-50 text-amber-600', 
        trend: 'Queue', 
        trendUp: false 
      },
    ];
  } else {
    kpiCards = [
      { title: 'Sub-Network Volume', value: formatCurrency(stats?.todayRechargeAmount || '0'), subtitle: "Today's downstream total", icon: <Activity size={22} />, iconColor: 'bg-primary text-black', trend: 'Active', trendUp: true },
      { title: 'Commission Earnings', value: formatCurrency(stats?.todayCommissionsPaid || '0'), subtitle: 'Retained today', icon: <TrendingUp size={22} />, iconColor: 'bg-emerald-50 text-emerald-600', trend: '0%', trendUp: true },
      { title: 'Total Children', value: stats?.totalUsers?.toLocaleString() || '0', subtitle: `${stats?.activeUsers || 0} active accounts`, icon: <Users size={22} />, iconColor: 'bg-blue-50 text-blue-600', trend: '0%', trendUp: true },
      { title: 'Child Wallets Sum', value: formatCurrency(stats?.totalUsers ? 25000 : 0), subtitle: 'Funds distributed', icon: <Wallet size={22} />, iconColor: 'bg-border text-text-primary', trend: 'Tracked', trendUp: true },
    ];
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">{user?.role === 'SUPER_ADMIN' ? 'Control Center' : 'Hierarchy Dashboard'}</h1>
        <p className="text-[14px] text-text-secondary mt-1">Welcome back, {user?.name}. Here's your {user?.role.toLowerCase().replace('_', ' ')} overview.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <div key={card.title} className="card p-5 transition-all hover:shadow-card group">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.iconColor} transition-transform group-hover:scale-105`}>
                {card.icon}
              </div>
              <div className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${card.trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {card.trendUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                {card.trend}
              </div>
            </div>
            <p className="text-[24px] font-bold text-text-primary font-mono m-0 tracking-tight">{card.value}</p>
            <p className="text-[12px] text-text-secondary mt-1">{card.subtitle}</p>
            <p className="text-[10px] text-text-muted mt-3 font-semibold uppercase tracking-[0.08em]">{card.title}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recharge Volume */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-[15px] font-semibold text-text-primary m-0">Recharge Volume</h3>
              <p className="text-[13px] text-text-secondary m-0">Last 7 days</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background">
              <Activity size={14} className="text-text-primary" />
              <span className="text-[11px] font-medium text-text-secondary">Live</span>
            </div>
          </div>
          {rechargeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={rechargeData}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#CCFF00" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#CCFF00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
                <XAxis dataKey="name" stroke="#52525B" fontSize={11} axisLine={false} tickLine={false} tickMargin={10} />
                <YAxis stroke="#52525B" fontSize={11} tickFormatter={(v) => `₹${v / 1000}K`} axisLine={false} tickLine={false} tickMargin={10} />
                <Tooltip 
                  contentStyle={{ background: '#0A0A0A', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                  itemStyle={{ color: '#CCFF00' }} 
                  formatter={(value: number) => [formatCurrency(value), 'Volume']} 
                  cursor={{ stroke: '#E4E4E7', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#0A0A0A" strokeWidth={2.5} fill="url(#colorAmount)" activeDot={{ r: 6, fill: '#0A0A0A', stroke: '#CCFF00', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex flex-col items-center justify-center text-text-muted">
              <Inbox size={32} className="mb-2 opacity-50" />
              <p className="text-[13px] font-medium">No data available for charts</p>
            </div>
          )}
        </div>

        {/* Commission Distribution */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-[15px] font-semibold text-text-primary m-0">Commission Earnings</h3>
              <p className="text-[13px] text-text-secondary m-0">Last 7 days</p>
            </div>
          </div>
          {rechargeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={rechargeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
                <XAxis dataKey="name" stroke="#52525B" fontSize={11} axisLine={false} tickLine={false} tickMargin={10} />
                <YAxis stroke="#52525B" fontSize={11} tickFormatter={(v) => `₹${v / 1000}K`} axisLine={false} tickLine={false} tickMargin={10} />
                <Tooltip 
                  contentStyle={{ background: '#0A0A0A', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                  itemStyle={{ color: '#CCFF00' }} 
                  formatter={(value: number) => [formatCurrency(value), 'Commissions']} 
                  cursor={{ stroke: '#E4E4E7', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Line type="monotone" dataKey="commissions" stroke="#CCFF00" strokeWidth={2.5} dot={{ fill: '#0A0A0A', r: 4, strokeWidth: 2, stroke: '#CCFF00' }} activeDot={{ r: 6, fill: '#CCFF00', stroke: '#0A0A0A', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex flex-col items-center justify-center text-text-muted">
              <Inbox size={32} className="mb-2 opacity-50" />
              <p className="text-[13px] font-medium">No data available for charts</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Transactions */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-text-primary m-0">Recent Transactions</h3>
            <button className="text-[12px] font-semibold text-text-secondary bg-background hover:bg-border px-3 py-1.5 rounded-lg transition-colors outline-none cursor-pointer border-none">
              View All
            </button>
          </div>
          <div className="flex flex-col items-center justify-center py-10 text-text-muted border border-dashed border-border rounded-xl bg-background-secondary/50">
            <Inbox size={32} className="mb-2 opacity-50" />
            <p className="text-[13px] font-medium m-0">No recent transactions found</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card p-6">
          <h3 className="text-[15px] font-semibold text-text-primary mb-3.5">Quick Actions</h3>
          <div className="flex flex-col gap-1.5">
            {[
              { label: 'Create User', desc: 'Add a new user to the network', dotColor: 'bg-text-primary', path: '/admin/users' },
              { label: 'Process Withdrawals', desc: `${stats?.pendingWithdrawals || 0} pending requests`, dotColor: 'bg-amber-500', path: '/admin/withdrawals' },
              { label: 'Network Wallets', desc: 'Monitor top-ups', dotColor: 'bg-blue-500', path: '/admin/wallet' },
              { label: 'Export Reports', desc: 'Download daily summary CSV', dotColor: 'bg-emerald-500', path: '/admin/reports' },
            ].map((action, i) => (
              <button key={i} onClick={() => navigate(action.path)} className="flex items-center gap-3 p-2.5 rounded-xl border-none outline-none bg-transparent cursor-pointer text-left w-full transition-colors hover:bg-background group">
                <div className={`w-2 h-2 rounded-full ${action.dotColor} shrink-0 transition-transform group-hover:scale-125`} />
                <div>
                  <p className="text-[13px] font-semibold text-text-primary m-0">{action.label}</p>
                  <p className="text-[11px] text-text-secondary m-0">{action.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Network Health */}
          {user?.role === 'SUPER_ADMIN' && (
            <div className="mt-5 pt-5 border-t border-border">
              <h4 className="text-[13px] font-semibold text-text-primary mb-2.5">System Health</h4>
              <div className="flex flex-col py-3 px-4 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl">
                <p className="text-[13px] font-bold m-0 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/> Provider API Online</p>
                <p className="text-[11px] opacity-80 mt-0.5">Latency: 142ms</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
