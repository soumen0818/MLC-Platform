import { useAuthStore } from '@/stores/authStore';
import { formatCurrency } from '@/lib/utils';
import { LoadingSpinner, StatusPill } from '@/components/ui';
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  CreditCard,
  Send,
  Network,
} from 'lucide-react';
import { ROLE_LABELS } from '@/types';

// Generic dashboard for State Head, Master Distributor, Distributor
export default function GenericDashboard() {
  const { user } = useAuthStore();

  if (!user) return <LoadingSpinner fullScreen />;

  const roleMap: Record<string, string> = {
    STATE_HEAD: 'Master Distributors',
    MASTER_DISTRIBUTOR: 'Distributors',
    DISTRIBUTOR: 'Retailers',
  };
  const childRoleLabel = roleMap[user.role] || 'Children';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display">Dashboard</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Welcome, {user.name} — {ROLE_LABELS[user.role]}
        </p>
      </div>

      {/* Wallet Hero Card */}
      <div className="bg-[#0A0A0A] rounded-3xl p-8 relative overflow-hidden shadow-xl border border-zinc-800/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={20} className="text-[#CCFF00]" />
              <span className="text-sm text-zinc-400 font-semibold tracking-wide uppercase">Wallet Balance</span>
            </div>
            <p className="text-4xl md:text-5xl font-bold font-mono text-white tracking-tight">
              {formatCurrency(user.walletBalance)}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="btn bg-[#CCFF00] text-black hover:bg-[#b8e600] font-bold text-sm py-2.5 px-6 shadow-[0_0_15px_rgba(204,255,0,0.2)]">
              <ArrowUpRight size={18} />
              Request Top-up
            </button>
            <button className="btn bg-white/10 border border-white/10 text-white hover:bg-white/20 text-sm py-2.5 px-6 backdrop-blur-sm">
              <Send size={18} />
              Transfer Funds
            </button>
          </div>
        </div>
        
        {/* Decorative Grid/Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#CCFF00]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Network size={20} className="text-blue-600" />
            </div>
            <span className="text-sm text-[var(--color-text-secondary)]">My {childRoleLabel}</span>
          </div>
          <p className="text-2xl font-bold font-mono">24</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">18 active</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <TrendingUp size={20} className="text-purple-600" />
            </div>
            <span className="text-sm text-[var(--color-text-secondary)]">Commission Today</span>
          </div>
          <p className="text-2xl font-bold font-mono text-[var(--color-success)]">
            {formatCurrency('2450.00')}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">This month: {formatCurrency('48500.00')}</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <CreditCard size={20} className="text-green-600" />
            </div>
            <span className="text-sm text-[var(--color-text-secondary)]">Total Transferred</span>
          </div>
          <p className="text-2xl font-bold font-mono">{formatCurrency('125000.00')}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">This month</p>
        </div>
      </div>

      {/* Network List */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">My {childRoleLabel}</h3>
          <button className="btn btn-ghost btn-sm">View All</button>
        </div>
        <div className="space-y-3">
          {[
            { name: 'Ravi Kumar', balance: '15000.00', recharges: 45, status: true },
            { name: 'Priya Singh', balance: '8500.00', recharges: 32, status: true },
            { name: 'Amit Patel', balance: '22000.00', recharges: 67, status: true },
            { name: 'Sneha Gupta', balance: '3200.00', recharges: 12, status: false },
          ].map((child, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-[var(--color-border)] last:border-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-900 text-sm font-bold border border-zinc-200">
                  {child.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-medium">{child.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{child.recharges} recharges this month</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold font-mono">{formatCurrency(child.balance)}</span>
                <StatusPill status={child.status ? 'ACTIVE' : 'INACTIVE'} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
