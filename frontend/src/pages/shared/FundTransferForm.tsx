import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Send, ArrowRight } from 'lucide-react';

export default function FundTransferForm() {
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [childId, setChildId] = useState('');
  const [amount, setAmount] = useState('');
  const [utr, setUtr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchChildren = async () => {
      try {
        const { data } = await api.get('/users');
        setChildren(data.users || []);
        if (data.users?.length > 0) setChildId(data.users[0].id);
      } catch {
        setChildren([]);
      } finally {
        setLoading(false);
      }
    };
    fetchChildren();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!childId) return toast.error('Please select a recipient');
    if (parseFloat(amount) <= 0) return toast.error('Enter a valid amount');

    if (!window.confirm(`Are you sure you want to transfer ₹${amount}?`)) return;

    setSubmitting(true);
    try {
      await api.post('/wallet/transfer', {
        childId,
        amount: parseFloat(amount),
        utrNumber: utr || undefined
      });
      toast.success('Funds transferred successfully!');
      setAmount('');
      setUtr('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Fund Transfer</h1>
        <p className="text-[14px] text-text-secondary mt-1">Distribute wallet liquidity to your downline nodes.</p>
      </div>

      <div className="max-w-xl">
        <div className="card p-6 border border-border">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[13px] font-bold text-text-secondary mb-2 uppercase tracking-wider">Recipient (Child Node)</label>
              {loading ? (
                <div className="h-11 bg-background animate-pulse rounded-lg border border-border"></div>
              ) : children.length === 0 ? (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-[13px] font-medium">
                  You do not have any active child nodes to transfer funds to.
                </div>
              ) : (
                <select 
                  value={childId} 
                  onChange={e => setChildId(e.target.value)}
                  className="w-full h-11 px-3 border border-border rounded-lg bg-background text-[14px] font-medium outline-none focus:border-primary"
                >
                  {children.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.role.replace('_', ' ')}) - {c.phone || c.email}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-[13px] font-bold text-text-secondary mb-2 uppercase tracking-wider">Transfer Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-bold">₹</span>
                <input 
                  required 
                  type="number" 
                  min="1" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)}
                  className="w-full h-11 pl-8 pr-3 border border-border rounded-lg bg-background text-[16px] font-mono outline-none focus:border-primary" 
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-bold text-text-secondary mb-2 uppercase tracking-wider">Bank UTR / Reference (Optional)</label>
              <input 
                type="text" 
                value={utr} 
                onChange={e => setUtr(e.target.value)}
                className="w-full h-11 px-3 border border-border rounded-lg bg-background text-[14px] outline-none focus:border-primary placeholder:text-text-muted" 
                placeholder="Required if settling external offline payment"
              />
            </div>

            <button 
              disabled={submitting || children.length === 0} 
              type="submit" 
              className="w-full h-12 mt-4 bg-primary text-black rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              <Send size={18} />
              {submitting ? 'Processing Transfer...' : 'Execute Transfer'}
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
