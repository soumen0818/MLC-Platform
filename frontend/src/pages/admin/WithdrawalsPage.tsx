import { useState, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { ArrowUpRight, Clock, CheckCircle, XCircle, Search } from 'lucide-react';

interface Withdrawal {
  id: string;
  userId: string;
  amountRequested: string;
  tdsDeducted: string;
  amountPayable: string;
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'REJECTED';
  bankAccountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  requestedAt: string;
  utrNumber?: string;
}

export default function WithdrawalsPage() {
  const { user } = useAuthStore();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State (User)
  const [amount, setAmount] = useState('');
  const [bankAcc, setBankAcc] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [holder, setHolder] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Process State (Admin)
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [utr, setUtr] = useState('');

  const fetchWithdrawals = async () => {
    try {
      setIsLoading(true);
      const endpoint = user?.role === 'SUPER_ADMIN' ? '/withdrawals/pending' : '/withdrawals/my';
      const { data } = await api.get(endpoint);
      setWithdrawals(data.withdrawals || []);
    } catch (err) {
      console.error('Failed to load withdrawals', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, [user]);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parseFloat(amount) < 100) return alert('Minimum withdrawal is ₹100');
    
    setIsSubmitting(true);
    try {
      await api.post('/withdrawals', {
        amount: parseFloat(amount),
        bankAccountNumber: bankAcc,
        ifscCode: ifsc,
        accountHolderName: holder
      });
      alert('Withdrawal request submitted successfully');
      setAmount(''); setBankAcc(''); setIfsc(''); setHolder('');
      fetchWithdrawals(); 
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcess = async (id: string, action: 'PAID' | 'REJECTED') => {
    if (action === 'PAID' && !utr.trim()) {
      return alert('UTR Number is required to approve payment');
    }
    const reason = action === 'REJECTED' ? window.prompt('Rejection Reason:') : undefined;
    if (action === 'REJECTED' && !reason) return;

    setProcessingId(id);
    try {
      await api.patch(`/withdrawals/${id}/process`, {
        action,
        utrNumber: action === 'PAID' ? utr : undefined,
        rejectionReason: reason
      });
      setUtr('');
      setWithdrawals(prev => prev.filter(w => w.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to process');
    } finally {
      setProcessingId(null);
    }
  };

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex flex-col gap-6 font-sans">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Fund Withdrawal</h1>
          <p className="text-[14px] text-text-secondary mt-1">Request a payout to your registered bank account.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h2 className="text-[16px] font-bold text-text-primary mb-4">Request Payout</h2>
            <form onSubmit={handleRequestSubmit} className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Amount (₹)</label>
                <input required type="number" min="100" value={amount} onChange={e => setAmount(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:border-primary outline-none" placeholder="Minimum ₹100" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Bank Account Number</label>
                <input required type="text" value={bankAcc} onChange={e => setBankAcc(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:border-primary outline-none" placeholder="Account Number" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">IFSC Code</label>
                <input required type="text" value={ifsc} onChange={e => setIfsc(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:border-primary outline-none" placeholder="e.g. HDFC0001234" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Account Holder Name</label>
                <input required type="text" value={holder} onChange={e => setHolder(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:border-primary outline-none" placeholder="Full Name as per Bank" />
              </div>
              <button disabled={isSubmitting} type="submit" className="w-full h-10 mt-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50">
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>

          <div className="card p-6">
            <h2 className="text-[16px] font-bold text-text-primary mb-4">Recent Withdrawals</h2>
            <div className="space-y-3">
              {isLoading ? <p className="text-[13px] text-text-muted">Loading...</p> : withdrawals.slice(0, 5).map(w => (
                <div key={w.id} className="p-3 border border-border rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-[14px] font-bold text-text-primary">₹{w.amountRequested}</p>
                    <p className="text-[12px] text-text-secondary">{new Date(w.requestedAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-[12px] font-medium ${w.status === 'PENDING' ? 'bg-yellow-50 text-yellow-700' : w.status === 'PAID' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {w.status}
                  </span>
                </div>
              ))}
              {withdrawals.length === 0 && !isLoading && <p className="text-[13px] text-text-muted">No recent requests.</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Super Admin View
  return (
    <div className="flex flex-col gap-6 font-sans">
       <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Withdrawal Queue</h1>
        <p className="text-[14px] text-text-secondary mt-1">Process pending payouts to users. Make sure to enter UTR.</p>
      </div>

      <div className="card overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase">User / Bank</th>
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase">Amount</th>
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase">Date</th>
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase text-right">Process Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                  <tr><td colSpan={4} className="py-8 text-center text-[13px] text-text-muted">Loading queue...</td></tr>
              ) : withdrawals.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-[13px] text-text-muted">No pending withdrawals.</td></tr>
              ) : withdrawals.map(w => (
                <tr key={w.id} className="hover:bg-table-hover transition-colors">
                  <td className="py-4 px-5">
                    <p className="text-[13px] font-medium text-text-primary">{w.accountHolderName}</p>
                    <p className="text-[12px] text-text-secondary font-mono">{w.bankAccountNumber} • {w.ifscCode}</p>
                  </td>
                  <td className="py-4 px-5">
                    <p className="text-[14px] font-bold text-text-primary">₹{w.amountPayable}</p>
                    <p className="text-[12px] text-text-secondary border border-border bg-background inline-block px-1 rounded">Req: ₹{w.amountRequested} (TDS: ₹{w.tdsDeducted})</p>
                  </td>
                  <td className="py-4 px-5">
                     <span className="text-[13px] text-text-secondary">{new Date(w.requestedAt).toLocaleDateString()}</span>
                  </td>
                  <td className="py-4 px-5 text-right flex flex-col items-end gap-2">
                    <input 
                      type="text" 
                      placeholder="Enter UTR Number" 
                      value={processingId === w.id ? utr : ''}
                      onChange={e => {
                        if (processingId !== w.id) setProcessingId(w.id);
                        setUtr(e.target.value);
                      }}
                      onFocus={() => { if(processingId !== w.id) setUtr('') }}
                      className="w-[180px] h-8 px-2 rounded border border-border text-[12px] focus:border-primary outline-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleProcess(w.id, 'REJECTED')} className="px-3 h-7 bg-red-50 text-red-700 rounded text-[12px] font-semibold hover:bg-red-100">Reject</button>
                      <button onClick={() => handleProcess(w.id, 'PAID')} className="px-3 h-7 bg-green-50 text-green-700 rounded text-[12px] font-semibold hover:bg-green-100">Paid</button>
                    </div>
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
