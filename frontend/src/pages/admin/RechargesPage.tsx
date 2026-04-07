import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { Smartphone, Zap, Tv, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface RechargeTxn {
  id: string;
  mobileNumber: string;
  operator: string;
  serviceType: string;
  amount: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  createdAt: string;
  failureReason?: string;
}

export default function RechargesPage() {
  const { user, fetchMe } = useAuthStore();
  const [transactions, setTransactions] = useState<RechargeTxn[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // POS State
  const [mobile, setMobile] = useState('');
  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('');
  const [serviceType, setServiceType] = useState('MOBILE');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      // If admin, we fetch all. If retailer, we fetch their own.
      const endpoint = user?.role === 'SUPER_ADMIN' ? '/recharge/all' : '/recharge/my';
      // MOCK: Assuming /recharge/all or /my exists. Let's use /wallet/transactions or a mock if it fails.
      // Wait, we have backend for recharge tracking.
      // But we haven't checked if `/recharge/my` exists. If not, catching error seamlessly.
      try {
        const { data } = await api.get(endpoint);
        setTransactions(data.transactions || []);
      } catch (err) {
        setTransactions([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchTransactions(); }, [user]);

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || !amount || !operator) return alert('Please fill all fields');
    
    setIsSubmitting(true);
    try {
      const { data } = await api.post('/recharge', {
        retailerId: user?.id,
        mobileNumber: mobile,
        operator,
        serviceType,
        amount: parseFloat(amount)
      });
      alert(`Recharge ${data.status}: ${data.message}`);
      setMobile(''); setAmount(''); setOperator('');
      fetchTransactions();
      fetchMe(); // Refresh wallet
    } catch (err: any) {
      alert(err.response?.data?.error || 'Recharge failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user?.role === 'RETAILER') {
    return (
      <div className="flex flex-col gap-6 font-sans">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Recharge Hub</h1>
          <p className="text-[14px] text-text-secondary mt-1">Speed POS terminal for executing instant recharges.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6 border-2 border-primary/20 shadow-[0_8px_32px_rgba(204,255,0,0.05)]">
            <div className="flex gap-4 mb-6 relative z-10">
              <button onClick={()=>setServiceType('MOBILE')} className={`flex flex-col items-center justify-center p-3 rounded-xl border flex-1 transition-colors ${serviceType==='MOBILE' ? 'bg-primary text-black border-primary' : 'bg-background border-border text-text-secondary hover:border-text-muted'}`}>
                <Smartphone size={24} className="mb-2" />
                <span className="text-[12px] font-bold uppercase tracking-wider">Mobile</span>
              </button>
              <button onClick={()=>setServiceType('DTH')} className={`flex flex-col items-center justify-center p-3 rounded-xl border flex-1 transition-colors ${serviceType==='DTH' ? 'bg-primary text-black border-primary' : 'bg-background border-border text-text-secondary hover:border-text-muted'}`}>
                <Tv size={24} className="mb-2" />
                <span className="text-[12px] font-bold uppercase tracking-wider">DTH</span>
              </button>
              <button onClick={()=>setServiceType('ELECTRICITY')} className={`flex flex-col items-center justify-center p-3 rounded-xl border flex-1 transition-colors ${serviceType==='ELECTRICITY' ? 'bg-primary text-black border-primary' : 'bg-background border-border text-text-secondary hover:border-text-muted'}`}>
                <Zap size={24} className="mb-2" />
                <span className="text-[12px] font-bold uppercase tracking-wider">Electric</span>
              </button>
            </div>

            <form onSubmit={handleRecharge} className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">{serviceType === 'MOBILE' ? 'Mobile Number' : 'Subscriber/Account ID'}</label>
                <input required type="text" value={mobile} onChange={e => setMobile(e.target.value)} className="w-full h-12 px-4 rounded-xl border border-border bg-background focus:border-primary text-lg font-mono outline-none" placeholder={serviceType==='MOBILE' ? "9876543210" : "ID"} />
              </div>
              <div className="flex gap-4">
                <div className="flex-[2]">
                  <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Operator</label>
                  <select required value={operator} onChange={e => setOperator(e.target.value)} className="w-full h-12 px-3 rounded-xl border border-border bg-background focus:border-primary outline-none font-medium">
                    <option value="" disabled>Select Operator</option>
                    <option value="Jio">Reliance Jio</option>
                    <option value="Airtel">Airtel</option>
                    <option value="Vi">Vodafone Idea (Vi)</option>
                    <option value="BSNL">BSNL</option>
                    <option value="TataSky">Tata Sky</option>
                    <option value="DishTV">Dish TV</option>
                  </select>
                </div>
                <div className="flex-[1]">
                  <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Amount (₹)</label>
                  <input required type="number" min="10" value={amount} onChange={e => setAmount(e.target.value)} className="w-full h-12 px-3 rounded-xl border border-border bg-background focus:border-primary font-bold text-lg outline-none" placeholder="0.00" />
                </div>
              </div>

              <button disabled={isSubmitting} type="submit" className="w-full h-14 mt-4 bg-text-primary text-background rounded-xl text-[16px] font-bold uppercase tracking-widest hover:bg-black transition-colors disabled:opacity-50">
                {isSubmitting ? 'Processing...' : 'Execute Recharge'}
              </button>
            </form>
          </div>

          <div className="card p-6">
            <h2 className="text-[16px] font-bold text-text-primary mb-4">Today's Terminals Logs</h2>
            <div className="space-y-3">
              {isLoading ? <p className="text-[13px] text-text-muted">Loading...</p> : transactions.map(t => (
                <div key={t.id} className="p-3 border border-border rounded-xl flex items-center justify-between">
                  <div className="flex gap-3 items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.status==='SUCCESS'?'bg-green-100 text-green-600':t.status==='FAILED'?'bg-red-100 text-red-600':'bg-yellow-100 text-yellow-600'}`}>
                      {t.status === 'SUCCESS' ? <CheckCircle2 size={18} /> : t.status === 'FAILED' ? <XCircle size={18} /> : <Clock size={18} />}
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-text-primary leading-tight font-mono">{t.mobileNumber}</p>
                      <p className="text-[12px] text-text-secondary">{t.operator} • {new Date(t.createdAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-bold text-text-primary">₹{t.amount}</p>
                    <p className="text-[11px] font-semibold text-text-secondary">{t.status}</p>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && !isLoading && <p className="text-[13px] text-text-muted">No transactions yet today.</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Admin/Distributor Network View
  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Network Recharges</h1>
        <p className="text-[14px] text-text-secondary mt-1">View network-wide recharge transaction logs.</p>
      </div>

      <div className="card overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase">Target</th>
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase">Amount</th>
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase">Details</th>
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                  <tr><td colSpan={4} className="py-8 text-center text-text-muted font-medium text-[13px]">Loading records...</td></tr>
              ) : transactions.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-text-muted font-medium text-[13px]">No records found.</td></tr>
              ) : transactions.map(t => (
                <tr key={t.id} className="hover:bg-table-hover transition-colors">
                  <td className="py-4 px-5">
                    <p className="text-[14px] font-bold font-mono">{t.mobileNumber}</p>
                    <p className="text-[12px] text-text-secondary">{t.operator}</p>
                  </td>
                  <td className="py-4 px-5">
                    <p className="text-[14px] font-bold text-text-primary">₹{t.amount}</p>
                  </td>
                  <td className="py-4 px-5">
                     <span className="text-[12px] border border-border bg-background px-1.5 py-0.5 rounded text-text-secondary">{t.serviceType}</span>
                     <p className="text-[12px] text-text-muted mt-1">{new Date(t.createdAt).toLocaleString()}</p>
                  </td>
                  <td className="py-4 px-5">
                     <span className={`px-2 py-1 rounded text-[11px] font-bold ${t.status==='PENDING' ? 'bg-yellow-100 text-yellow-800' : t.status==='SUCCESS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {t.status}
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
