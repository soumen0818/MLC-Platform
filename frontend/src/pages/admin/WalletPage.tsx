import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';

interface TopupRequest {
  id: string;
  amount: string;
  utrNumber: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  requesterName?: string;
  requesterPhone?: string;
}

export default function WalletPage() {
  const { user, fetchMe } = useAuthStore();
  
  // State for My Requests
  const [myRequests, setMyRequests] = useState<TopupRequest[]>([]);
  const [isLoadingMy, setIsLoadingMy] = useState(false);
  
  // State for Pending Child Requests
  const [pendingRequests, setPendingRequests] = useState<TopupRequest[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);

  // Form State
  const [amount, setAmount] = useState('');
  const [utr, setUtr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadData = async () => {
    // Regular users (not SUPER_ADMIN) can make requests
    if (user?.role !== 'SUPER_ADMIN') {
      setIsLoadingMy(true);
      try {
        const { data } = await api.get('/wallet/topup/my-requests');
        setMyRequests(data.requests || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoadingMy(false);
      }
    }

    // Admins and parents can view pending requests from children
    if (user?.role !== 'RETAILER') {
      setIsLoadingPending(true);
      try {
        const { data } = await api.get('/wallet/topup/pending');
        setPendingRequests(data.requests || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoadingPending(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleRequestTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parseFloat(amount) <= 0) return alert('Invalid amount');
    
    setIsSubmitting(true);
    try {
      await api.post('/wallet/topup/request', { amount: parseFloat(amount), utrNumber: utr });
      alert('Topup requested successfully. Waiting for parent approval.');
      setAmount(''); setUtr('');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to request topup');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessRequest = async (id: string, action: 'APPROVED' | 'REJECTED') => {
    if (action === 'APPROVED' && !window.confirm('Are you sure? This will deduct from your balance.')) return;
    
    setProcessingId(id);
    try {
      await api.patch(`/wallet/topup/${id}/process`, { action });
      alert(`Request ${action}`);
      setPendingRequests(prev => prev.filter(r => r.id !== id));
      fetchMe(); // update parent's balance
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to process');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-8 font-sans pb-10">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Wallet Funding Manager</h1>
        <p className="text-[14px] text-text-secondary mt-1">Manage top-up requests and review your hierarchy's funding pipeline.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Child: Request Topup Form */}
        {user?.role !== 'SUPER_ADMIN' && (
          <div className="card p-6 h-fit bg-card border border-border">
            <h2 className="text-[16px] font-bold text-text-primary mb-4">Request Wallet Top-up</h2>
            <form onSubmit={handleRequestTopup} className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Top-up Amount (₹)</label>
                <input required type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:border-primary outline-none" placeholder="Amount transferred to parent" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">UTR / Bank Reference No.</label>
                <input required type="text" value={utr} onChange={e => setUtr(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:border-primary outline-none" placeholder="e.g. 123456789012" />
              </div>
              <button disabled={isSubmitting} type="submit" className="w-full h-10 mt-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50">
                {isSubmitting ? 'Submitting...' : 'Send Request to Parent'}
              </button>
            </form>
          </div>
        )}

        {/* Parent: Approve Child Requests */}
        {user?.role !== 'RETAILER' && (
          <div className={`card p-6 border border-border ${user?.role === 'SUPER_ADMIN' ? 'lg:col-span-2' : ''}`}>
            <h2 className="text-[16px] font-bold text-text-primary mb-4">Pending Child Requests</h2>
            <div className="space-y-3">
              {isLoadingPending ? (
                <p className="text-[13px] text-text-muted">Loading pending requests...</p>
              ) : pendingRequests.length === 0 ? (
                <p className="text-[13px] text-text-muted">No pending requests from your downstream tree.</p>
              ) : pendingRequests.map(req => (
                <div key={req.id} className="p-4 border border-border rounded-xl flex flex-col sm:flex-row justify-between gap-4 sm:items-center bg-background/50">
                  <div>
                    <h3 className="text-[15px] font-bold text-text-primary mb-1">₹{req.amount}</h3>
                    <p className="text-[13px] font-medium text-text-secondary border border-border bg-background inline-block px-1.5 rounded">{req.requesterName} ({req.requesterPhone})</p>
                    <p className="text-[12px] text-text-muted mt-1 font-mono hover:text-text-primary">UTR: {req.utrNumber}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleProcessRequest(req.id, 'REJECTED')}
                      disabled={processingId === req.id}
                      className="px-4 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-[13px] font-semibold hover:bg-red-100 disabled:opacity-50"
                    >Reject</button>
                    <button 
                      onClick={() => handleProcessRequest(req.id, 'APPROVED')}
                      disabled={processingId === req.id}
                      className="px-4 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-[13px] font-semibold hover:bg-green-100 disabled:opacity-50"
                    >Approve (Credit)</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Child: View Own Requests History */}
        {user?.role !== 'SUPER_ADMIN' && (
          <div className="card p-6 border border-border lg:col-span-2">
            <h2 className="text-[16px] font-bold text-text-primary mb-4">My Top-up History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border text-[12px] text-text-secondary uppercase">
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4">Amount</th>
                    <th className="pb-3 pr-4">UTR Number</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoadingMy ? (
                    <tr><td colSpan={4} className="py-4 text-[13px] text-text-muted">Loading...</td></tr>
                  ) : myRequests.length === 0 ? (
                    <tr><td colSpan={4} className="py-4 text-[13px] text-text-muted">No top-up requests yet.</td></tr>
                  ) : myRequests.map(req => (
                    <tr key={req.id}>
                      <td className="py-3 pr-4 text-[13px] text-text-secondary">{new Date(req.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 pr-4 text-[14px] font-bold text-text-primary">₹{req.amount}</td>
                      <td className="py-3 pr-4 text-[13px] font-mono text-text-secondary">{req.utrNumber}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${req.status==='PENDING' ? 'bg-yellow-100 text-yellow-800' : req.status==='APPROVED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
