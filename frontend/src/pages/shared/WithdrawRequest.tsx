import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Building2, ArrowRight, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

export default function WithdrawRequest() {
  const { user, fetchMe } = useAuthStore();
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [amount, setAmount] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [holderName, setHolderName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchHistory = async () => {
    try {
      const { data } = await api.get('/withdrawals/my');
      setWithdrawals(data.withdrawals || []);
    } catch {
      setWithdrawals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parseFloat(amount) < 100) return toast.error('Minimum withdrawal is ₹100');
    
    setSubmitting(true);
    try {
      await api.post('/withdrawals', {
        amount: parseFloat(amount),
        bankAccountNumber: bankAccount,
        ifscCode: ifsc,
        accountHolderName: holderName
      });
      toast.success('Withdrawal request submitted successfully');
      setAmount(''); setBankAccount(''); setIfsc(''); setHolderName('');
      fetchHistory();
      fetchMe(); // Update wallet balance in UI
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans pb-10">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Withdraw Funds</h1>
        <p className="text-[14px] text-text-secondary mt-1">Transfer wallet balance to your registered bank account.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="card p-6 border border-border sticky top-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[16px] font-bold text-text-primary">New Request</h2>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-background border border-border rounded-lg text-[11px] font-bold text-text-secondary">
                <Wallet size={12} /> ₹{user?.walletBalance}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-text-secondary mb-1.5 uppercase tracking-wider">Amount (₹)</label>
                <input required type="number" min="100" value={amount} onChange={e => setAmount(e.target.value)} className="w-full h-11 px-3 border border-border rounded-lg bg-background text-[15px] font-mono outline-none focus:border-primary" placeholder="Min ₹100" />
                <p className="text-[10px] text-text-muted mt-1.5 font-medium">Note: 5% TDS applies on withdrawals over ₹30,000</p>
              </div>
              <div className="pt-2 border-t border-border">
                <label className="block text-[12px] font-bold text-text-secondary mb-1.5 uppercase tracking-wider mt-2">Account Holder Name</label>
                <input required type="text" value={holderName} onChange={e => setHolderName(e.target.value)} className="w-full h-11 px-3 border border-border rounded-lg bg-background text-[13px] outline-none focus:border-primary" placeholder="As per bank records" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-text-secondary mb-1.5 uppercase tracking-wider">Bank Account Number</label>
                <input required type="text" value={bankAccount} onChange={e => setBankAccount(e.target.value)} className="w-full h-11 px-3 border border-border rounded-lg bg-background text-[13px] font-mono outline-none focus:border-primary" placeholder="Account Number" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-text-secondary mb-1.5 uppercase tracking-wider">IFSC Code</label>
                <input required type="text" value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())} className="w-full h-11 px-3 border border-border rounded-lg bg-background text-[13px] font-mono outline-none focus:border-primary uppercase" placeholder="e.g. SBIN0001234" />
              </div>

              <button disabled={submitting || parseFloat(amount) > parseFloat(user?.walletBalance || '0')} type="submit" className="w-full h-11 mt-2 bg-primary text-black rounded-lg font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50">
                <Building2 size={16} />
                {submitting ? 'Processing...' : 'Submit Request'}
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card border border-border">
            <div className="p-4 border-b border-border bg-background/50">
              <h2 className="text-[15px] font-bold text-text-primary">Withdrawal History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-background text-[11px] uppercase tracking-wider text-text-secondary border-b border-border">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Bank Details</th>
                    <th className="py-3 px-4 text-right">Requested</th>
                    <th className="py-3 px-4 text-right">TDS/Fees</th>
                    <th className="py-3 px-4 text-right">Payable</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={6} className="py-8 text-center text-[13px] text-text-muted">Loading history...</td></tr>
                  ) : withdrawals.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-[13px] text-text-muted">No withdrawal requests found.</td></tr>
                  ) : withdrawals.map(w => (
                    <tr key={w.id} className="hover:bg-background/50 transition-colors">
                      <td className="py-3 px-4 text-[12px] text-text-secondary">{new Date(w.requestedAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        <p className="text-[12px] font-bold text-text-primary">{w.accountHolderName}</p>
                        <p className="text-[11px] font-mono text-text-muted mt-0.5">{w.bankAccountNumber}</p>
                        <p className="text-[10px] font-mono text-text-muted">{w.ifscCode}</p>
                      </td>
                      <td className="py-3 px-4 text-right text-[13px] font-medium text-text-primary">{formatCurrency(parseFloat(w.amountRequested))}</td>
                      <td className="py-3 px-4 text-right text-[12px] font-medium text-red-500">-{formatCurrency(parseFloat(w.tdsDeducted))}</td>
                      <td className="py-3 px-4 text-right text-[13px] font-bold text-text-primary">{formatCurrency(parseFloat(w.amountPayable))}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                          ${w.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500' : 
                            w.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' : 
                            'bg-red-500/10 text-red-500'}`}>
                          {w.status}
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
