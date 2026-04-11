import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, ArrowDownRight, Inbox } from 'lucide-react';

export default function CommissionHistory() {
  const [commissions, setCommissions] = useState<any[]>([]);
  const [totals, setTotals] = useState({ earned: '0', reversed: '0' });
  const [loading, setLoading] = useState(true);

  const fetchCommissions = async () => {
    try {
      const { data } = await api.get('/commission/my');
      setCommissions(data.commissions || []);
      setTotals(data.totals || { earned: '0', reversed: '0' });
    } catch {
      setCommissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCommissions(); }, []);

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">My Commissions</h1>
        <p className="text-[14px] text-text-secondary mt-1">Track your earnings across your network.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-6 border border-emerald-500/20 bg-emerald-50/5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-[12px] font-bold text-text-secondary uppercase tracking-wider">Total Earned</p>
              <p className="text-[24px] font-bold text-text-primary font-mono">{formatCurrency(parseFloat(totals.earned))}</p>
            </div>
          </div>
        </div>
        <div className="card p-6 border border-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center text-text-muted">
              <ArrowDownRight size={20} />
            </div>
            <div>
              <p className="text-[12px] font-bold text-text-secondary uppercase tracking-wider">Total Reversed</p>
              <p className="text-[24px] font-bold text-text-primary font-mono">{formatCurrency(parseFloat(totals.reversed))}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card border border-border">
        <div className="p-4 border-b border-border bg-background/50">
          <h2 className="text-[14px] font-bold text-text-primary">Recent Earnings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-background text-[11px] uppercase tracking-wider text-text-secondary border-b border-border">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={5} className="py-8 text-center text-[13px] text-text-muted">Loading...</td></tr>
              ) : commissions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <Inbox size={32} className="mx-auto text-text-muted mb-3 opacity-50" />
                    <p className="text-[13px] text-text-muted">No commissions generated yet.</p>
                  </td>
                </tr>
              ) : commissions.map(c => (
                <tr key={c.id} className="hover:bg-background/50 transition-colors">
                  <td className="py-3 px-4 text-[13px] text-text-secondary">{new Date(c.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-4 text-[13px] font-mono text-text-muted">{c.rechargeTxnId.slice(0, 12)}...</td>
                  <td className="py-3 px-4 text-[13px] font-medium text-text-primary">{c.serviceType}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${c.status === 'CREDITED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`text-[14px] font-bold font-mono ${c.status === 'CREDITED' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {c.status === 'CREDITED' ? '+' : '-'}{formatCurrency(parseFloat(c.amountCredited))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
