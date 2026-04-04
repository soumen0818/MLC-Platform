import { useAuthStore } from '@/stores/authStore';
import { formatCurrency } from '@/lib/utils';
import { LoadingSpinner, StatusPill } from '@/components/ui';
import { Wallet, TrendingUp, ArrowUpRight, CreditCard, Send, Network, Inbox } from 'lucide-react';
import { ROLE_LABELS } from '@/types';

export default function GenericDashboard() {
  const { user } = useAuthStore();
  if (!user) return <LoadingSpinner fullScreen />;

  const roleMap: Record<string, string> = {
    STATE_HEAD: 'Master Distributors',
    MASTER_DISTRIBUTOR: 'Distributors',
    DISTRIBUTOR: 'Retailers',
  };
  const childRoleLabel = roleMap[user.role] || 'Children';

  const children: any[] = []; // Removed dummy data

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Dashboard</h1>
        <p className="text-[14px] text-text-secondary mt-1">Welcome, {user.name} — {ROLE_LABELS[user.role]}</p>
      </div>

      {/* Wallet Hero */}
      <div className="card-gradient p-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap justify-between items-end gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={18} className="text-primary" />
              <span className="text-[12px] text-white/70 font-semibold uppercase tracking-[0.08em]">Wallet Balance</span>
            </div>
            <p className="text-[36px] font-bold text-white m-0 font-mono tracking-tight">
              {formatCurrency(user.walletBalance)}
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-none bg-primary text-black text-[13px] font-bold cursor-pointer transition-all hover:bg-opacity-90 shadow-[0_0_15px_rgba(204,255,0,0.2)]">
              <ArrowUpRight size={16} /> Request Top-up
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/20 bg-white/10 text-white text-[13px] font-semibold cursor-pointer transition-all hover:bg-white/20">
              <Send size={16} /> Transfer Funds
            </button>
          </div>
        </div>
        <div className="absolute -top-8 -right-5 w-[180px] h-[180px] rounded-full bg-primary/10 pointer-events-none" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-[38px] h-[38px] rounded-xl bg-blue-50 flex items-center justify-center">
              <Network size={18} className="text-blue-600" />
            </div>
            <span className="text-[13px] text-text-secondary">My {childRoleLabel}</span>
          </div>
          <p className="text-[22px] font-bold text-text-primary m-0 font-mono">0</p>
          <p className="text-[11px] text-text-muted mt-1">0 active</p>
        </div>
        
        <div className="card p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-[38px] h-[38px] rounded-xl bg-violet-50 flex items-center justify-center">
              <TrendingUp size={18} className="text-violet-600" />
            </div>
            <span className="text-[13px] text-text-secondary">Commission Today</span>
          </div>
          <p className="text-[22px] font-bold text-emerald-500 m-0 font-mono">{formatCurrency('0.00')}</p>
          <p className="text-[11px] text-text-muted mt-1">This month: {formatCurrency('0.00')}</p>
        </div>
        
        <div className="card p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-[38px] h-[38px] rounded-xl bg-emerald-50 flex items-center justify-center">
              <CreditCard size={18} className="text-emerald-600" />
            </div>
            <span className="text-[13px] text-text-secondary">Total Transferred</span>
          </div>
          <p className="text-[22px] font-bold text-text-primary m-0 font-mono">{formatCurrency('0.00')}</p>
          <p className="text-[11px] text-text-muted mt-1">This month</p>
        </div>
      </div>

      {/* Network List */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-text-primary m-0">My {childRoleLabel}</h3>
          <button className="text-[12px] font-semibold text-text-secondary bg-transparent border-none cursor-pointer hover:text-text-primary">View All</button>
        </div>
        
        {children.length > 0 ? children.map((child, i) => (
          <div key={i} className={`flex items-center justify-between py-3 ${i < children.length - 1 ? 'border-b border-border' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center text-[12px] font-bold text-text-primary">
                {child.name.split(' ').map((n: string) => n[0]).join('')}
              </div>
              <div>
                <p className="text-[13px] font-medium text-text-primary m-0">{child.name}</p>
                <p className="text-[11px] text-text-muted m-0">{child.recharges} recharges this month</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[13px] font-bold font-mono text-text-primary">{formatCurrency(child.balance)}</span>
              <StatusPill status={child.status ? 'ACTIVE' : 'INACTIVE'} />
            </div>
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center py-8 text-text-muted">
            <Inbox size={32} className="mb-2 opacity-50" />
            <p className="text-[13px] font-medium m-0">No network members found</p>
          </div>
        )}
      </div>
    </div>
  );
}
