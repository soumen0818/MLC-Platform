import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Smartphone, CheckCircle2, XCircle, Clock, Inbox } from 'lucide-react';

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

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<RechargeTxn[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const { data } = await api.get('/recharge/history');
        setTransactions(data.transactions || []);
      } catch {
        setTransactions([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Recharge History</h1>
        <p className="text-[14px] text-text-secondary mt-1">Your complete recharge transaction log.</p>
      </div>

      <div className="card overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase tracking-wider">Target</th>
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase tracking-wider">Operator</th>
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase tracking-wider">Type</th>
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase tracking-wider">Amount</th>
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase tracking-wider">Date</th>
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-text-muted">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-[13px]">Loading history...</p>
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Inbox size={32} className="mx-auto text-text-muted mb-3 opacity-50" />
                    <p className="text-[14px] font-medium text-text-primary">No transactions yet</p>
                    <p className="text-[13px] text-text-muted">Execute your first recharge to see history here.</p>
                  </td>
                </tr>
              ) : transactions.map(t => (
                <tr key={t.id} className="hover:bg-table-hover transition-colors">
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        t.status === 'SUCCESS' ? 'bg-green-100 text-green-600' :
                        t.status === 'FAILED' ? 'bg-red-100 text-red-600' :
                        'bg-yellow-100 text-yellow-600'
                      }`}>
                        {t.status === 'SUCCESS' ? <CheckCircle2 size={16} /> :
                         t.status === 'FAILED' ? <XCircle size={16} /> :
                         <Clock size={16} />}
                      </div>
                      <span className="text-[14px] font-bold font-mono text-text-primary">{t.mobileNumber}</span>
                    </div>
                  </td>
                  <td className="py-4 px-5 text-[13px] text-text-secondary">{t.operator}</td>
                  <td className="py-4 px-5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-background border border-border text-text-secondary">
                      <Smartphone size={10} /> {t.serviceType}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-[14px] font-bold font-mono text-text-primary">₹{t.amount}</td>
                  <td className="py-4 px-5 text-[12px] text-text-secondary">{new Date(t.createdAt).toLocaleString('en-IN')}</td>
                  <td className="py-4 px-5">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider ${
                      t.status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
                      t.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                      t.status === 'REFUNDED' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
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
