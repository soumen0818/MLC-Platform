import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowUpRight, Clock, CheckCircle2, XCircle, Inbox, Wallet } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency } from '@/lib/utils';

export default function TopupPage() {
  const { user, fetchMe } = useAuthStore();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState('');
  const [utr, setUtr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [parentInfo, setParentInfo] = useState<any>(null);

  const fetchHistory = async () => {
    try {
      const { data } = await api.get('/wallet/topup/my-requests');
      setRequests(data.requests || []);
      
      if (user?.parentId) {
        const parentRes = await api.get(`/users/${user.parentId}`);
        setParentInfo(parentRes.data.user);
      }
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (user) fetchHistory(); 
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parseFloat(amount) < 100) return toast.error('Minimum top-up request is ₹100');
    if (!utr.trim()) return toast.error('UTR / Reference number is required');

    setSubmitting(true);
    try {
      await api.post('/wallet/topup/request', {
        amount: parseFloat(amount),
        utrNumber: utr.trim(),
      });
      toast.success('Top-up request submitted! Your parent will credit your wallet shortly.');
      setAmount('');
      setUtr('');
      await fetchHistory();
      await fetchMe();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans pb-10">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Top-up Request</h1>
        <p className="text-[14px] text-text-secondary mt-1">Request your parent node to add funds to your wallet.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request Form */}
        <div className="lg:col-span-1">
          <div className="card p-6 border border-border sticky top-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[16px] font-bold text-text-primary">New Request</h2>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-background border border-border rounded-lg text-[11px] font-bold text-text-secondary">
                <Wallet size={12} /> {formatCurrency(user?.walletBalance || '0')}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-text-secondary mb-1.5 uppercase tracking-wider">Amount (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-bold">₹</span>
                  <input
                    required
                    type="number"
                    min="100"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full h-11 pl-8 pr-3 border border-border rounded-lg bg-background text-[15px] font-mono outline-none focus:border-primary"
                    placeholder="Min ₹100"
                  />
                </div>
              </div>

              {parentInfo && (
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold text-primary uppercase tracking-wider">Send Money To Admin</span>
                  {parentInfo.upiId ? (
                    <div className="flex items-center justify-between">
                       <span className="text-[15px] font-mono font-bold text-text-primary">{parentInfo.upiId}</span>
                       <span className="text-[10px] bg-primary text-black px-2 py-0.5 rounded font-bold">UPI</span>
                    </div>
                  ) : (
                    <span className="text-[13px] text-text-muted">Your admin hasn't set their UPI ID yet. Reach out to them directly.</span>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[12px] font-bold text-text-secondary mb-1.5 uppercase tracking-wider">Bank UTR / Reference No.</label>
                <input
                  required
                  type="text"
                  value={utr}
                  onChange={e => setUtr(e.target.value)}
                  className="w-full h-11 px-3 border border-border rounded-lg bg-background text-[13px] outline-none focus:border-primary placeholder:text-text-muted"
                  placeholder="e.g. 123456789012"
                />
                <p className="text-[11px] text-text-muted mt-1.5">Transfer the amount to your parent's bank account and enter the UTR here as proof.</p>
              </div>

              <button
                disabled={submitting}
                type="submit"
                className="w-full h-11 mt-2 bg-primary text-black rounded-lg font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50"
              >
                <ArrowUpRight size={16} />
                {submitting ? 'Submitting...' : 'Submit Top-up Request'}
              </button>
            </form>
          </div>
        </div>

        {/* History */}
        <div className="lg:col-span-2">
          <div className="card border border-border">
            <div className="p-4 border-b border-border bg-background/50">
              <h2 className="text-[15px] font-bold text-text-primary">Request History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-background text-[11px] uppercase tracking-wider text-text-secondary border-b border-border">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">UTR Ref</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={4} className="py-8 text-center text-[13px] text-text-muted">Loading history...</td></tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center">
                        <Inbox size={28} className="mx-auto text-text-muted mb-3 opacity-50" />
                        <p className="text-[13px] text-text-muted">No top-up requests found.</p>
                      </td>
                    </tr>
                  ) : requests.map(r => (
                    <tr key={r.id} className="hover:bg-background/50 transition-colors">
                      <td className="py-3 px-4 text-[12px] text-text-secondary">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-right text-[13px] font-bold font-mono text-text-primary">{formatCurrency(parseFloat(r.amount))}</td>
                      <td className="py-3 px-4 text-[12px] font-mono text-text-muted">{r.utrNumber || '—'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          r.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500' :
                          r.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' :
                          'bg-red-500/10 text-red-500'
                        }`}>
                          {r.status === 'PENDING' ? <Clock size={10} /> :
                           r.status === 'APPROVED' ? <CheckCircle2 size={10} /> :
                           <XCircle size={10} />}
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
