import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Inbox, RefreshCw, TrendingUp, Banknote, Layers } from 'lucide-react';

function fmt(val: number | string) {
  return '₹' + parseFloat((val as string) || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

type FilterTab = 'ALL' | 'MAIN' | 'COMMISSION';

const REASON_LABEL: Record<string, string> = {
  RECHARGE: 'Recharge Debit',
  COMMISSION: 'Commission Earned',
  TOPUP: 'Wallet Top-up',
  WITHDRAWAL: 'Withdrawal',
  REVERSAL: 'Reversal / Refund',
  MANUAL_ADJUSTMENT: 'Manual Adjustment',
};

export default function WalletStatement() {
  const [balances, setBalances] = useState<{ mainBalance: string; commissionBalance: string; totalBalance: string } | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('ALL');

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [balRes, txRes] = await Promise.all([
        api.get('/wallet/balance/full'),
        api.get('/wallet/transactions?limit=50'),
      ]);
      setBalances(balRes.data);
      setTransactions(txRes.data.transactions || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = filter === 'ALL'
    ? transactions
    : transactions.filter(t => (t.walletType || 'MAIN') === filter);

  return (
    <div className="flex flex-col gap-6 font-sans">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Wallet</h1>
          <p className="text-[14px] text-text-secondary mt-1">Your balance, earnings, and full transaction ledger.</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-background text-[12px] font-semibold text-text-secondary hover:border-text-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Main Wallet */}
        <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-background border border-border flex items-center justify-center">
                <Banknote size={16} className="text-text-primary" />
              </div>
              <span className="text-[12px] font-bold text-text-secondary uppercase tracking-wider">Main Wallet</span>
            </div>
          </div>
          <div>
            <p className="text-[30px] font-bold text-text-primary font-mono leading-none">
              {loading ? <span className="text-text-muted text-[20px]">Loading...</span> : fmt(balances?.mainBalance || 0)}
            </p>
            <p className="text-[11px] text-text-muted mt-2">From bank top-ups · Withdrawable · Transferable</p>
          </div>
        </div>

        {/* Commission Wallet */}
        <div className="rounded-2xl border-2 border-primary p-6 flex flex-col gap-3" style={{ background: 'linear-gradient(135deg, #0A0A0A 0%, #111800 100%)' }}>
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(204,255,0,0.15)' }}>
              <TrendingUp size={16} style={{ color: '#CCFF00' }} />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ color: '#CCFF00', borderColor: 'rgba(204,255,0,0.5)', background: 'rgba(204,255,0,0.1)' }}>
              LOCKED
            </span>
          </div>
          <div>
            <span className="text-[12px] font-bold uppercase tracking-wider block mb-1" style={{ color: '#CCFF00' }}>Commission Wallet</span>
            <p className="text-[30px] font-bold font-mono leading-none" style={{ color: '#CCFF00' }}>
              {loading ? <span style={{ color: 'rgba(204,255,0,0.5)', fontSize: '20px' }}>Loading...</span> : fmt(balances?.commissionBalance || 0)}
            </p>
            <p className="text-[11px] mt-2" style={{ color: 'rgba(255,255,255,0.6)' }}>Earned from recharges · Auto-used for recharges</p>
          </div>
        </div>

        {/* Total */}
        <div className="rounded-2xl border-2 border-border bg-background p-6 flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-background border border-border flex items-center justify-center">
              <Layers size={16} className="text-text-secondary" />
            </div>
            <span className="text-[12px] font-bold text-text-secondary uppercase tracking-wider">Total Available</span>
          </div>
          <div>
            <p className="text-[30px] font-bold text-text-primary font-mono leading-none">
              {loading ? <span className="text-text-muted text-[20px]">Loading...</span> : fmt(balances?.totalBalance || 0)}
            </p>
            <p className="text-[11px] text-text-muted mt-2">Commission funds drain first on every recharge</p>
          </div>
        </div>
      </div>

      {/* Ledger */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        
        {/* Ledger Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
          <h2 className="text-[14px] font-bold text-text-primary">Transaction Ledger</h2>
          <div className="flex items-center gap-1 p-1 bg-background rounded-xl border border-border">
            {(['ALL', 'MAIN', 'COMMISSION'] as FilterTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  filter === tab
                    ? 'bg-primary text-black shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab === 'ALL' ? 'All' : tab === 'MAIN' ? 'Main' : 'Commission'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 px-5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Date & Time</th>
                <th className="py-3 px-5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Description</th>
                <th className="py-3 px-5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Wallet</th>
                <th className="py-3 px-5 text-[10px] font-bold text-text-muted uppercase tracking-wider text-right">Amount</th>
                <th className="py-3 px-5 text-[10px] font-bold text-text-muted uppercase tracking-wider text-right">Balance After</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td colSpan={5} className="py-4 px-5">
                      <div className="h-4 bg-border rounded animate-pulse w-full" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <Inbox size={28} className="mx-auto text-text-muted mb-3 opacity-40" />
                    <p className="text-[13px] text-text-muted font-medium">No transactions found</p>
                  </td>
                </tr>
              ) : filtered.map(tx => {
                const isCredit = tx.type === 'CREDIT';
                const isCommission = (tx.walletType || 'MAIN') === 'COMMISSION';
                return (
                  <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-background/60 transition-colors">
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <p className="text-[12px] font-medium text-text-primary">{new Date(tx.createdAt).toLocaleDateString('en-IN')}</p>
                      <p className="text-[11px] text-text-muted">{new Date(tx.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="py-3.5 px-5">
                      <p className="text-[13px] font-semibold text-text-primary">{REASON_LABEL[tx.reason] || tx.reason}</p>
                      {tx.note && <p className="text-[11px] text-text-muted mt-0.5 max-w-[240px] truncate">{tx.note}</p>}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                        isCommission
                          ? 'bg-violet-100 border-violet-200 text-violet-700'
                          : 'bg-slate-100 border-slate-200 text-slate-600'
                      }`}>
                        {isCommission ? <TrendingUp size={9} /> : <Banknote size={9} />}
                        {isCommission ? 'Commission' : 'Main'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <span className={`text-[14px] font-bold font-mono ${isCredit ? 'text-emerald-500' : 'text-text-primary'}`}>
                        <span className="text-[12px] mr-0.5 opacity-60">{isCredit ? '+' : '−'}</span>
                        {fmt(tx.amount)}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <span className="text-[13px] font-mono font-medium text-text-secondary">{fmt(tx.closingBalance)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
