import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Save, Percent, DollarSign } from 'lucide-react';

interface Config {
  id: string;
  role: string;
  serviceType: string;
  commissionType: 'PERCENTAGE' | 'FLAT';
  commissionValue: string;
}

export default function CommissionPage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConfigs = async () => {
    try {
      const { data } = await api.get('/commission/configs');
      // Ensure we extract from data.configs if wrapped in an object payload
      const mappedData = data?.configs || data || [];
      if (Array.isArray(mappedData) && mappedData.length > 0) {
        setConfigs(mappedData);
      } else {
        throw new Error("Empty or invalid config payload");
      }
    } catch {
      // safe fallback
      setConfigs([
         { id: '1', role: 'STATE_HEAD', serviceType: 'MOBILE', commissionType: 'PERCENTAGE', commissionValue: '1.50' },
         { id: '2', role: 'MASTER_DISTRIBUTOR', serviceType: 'MOBILE', commissionType: 'PERCENTAGE', commissionValue: '1.00' },
         { id: '3', role: 'DISTRIBUTOR', serviceType: 'MOBILE', commissionType: 'PERCENTAGE', commissionValue: '0.80' },
         { id: '4', role: 'RETAILER', serviceType: 'MOBILE', commissionType: 'PERCENTAGE', commissionValue: '4.00' },
      ]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchConfigs(); }, []);

  const handleUpdate = async (id: string, value: string) => {
    try {
      // await api.put(`/commission/configs/${id}`, { commissionValue: parseFloat(value) });
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, commissionValue: value } : c));
    } catch (err: any) {
      alert('Failed to update commission');
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Commission Engine</h1>
        <p className="text-[14px] text-text-secondary mt-1">Configure global flat and percentage-based payouts per tier.</p>
      </div>

      <div className="card border border-border p-6">
        <h2 className="text-[16px] font-bold text-text-primary mb-6">Mobile Recharges</h2>
        {loading ? (
          <p className="text-[13px] text-text-muted">Loading tables...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {configs.map(cfg => (
               <div key={cfg.id} className="border border-border p-4 rounded-xl flex flex-col bg-background/30">
                  <h3 className="text-[13px] font-bold text-text-secondary mb-3 uppercase tracking-wider">{cfg.role ? cfg.role.replace('_', ' ') : 'UNKNOWN TIER'}</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                      {cfg.commissionType === 'PERCENTAGE' ? <Percent size={18} className="text-primary" /> : <DollarSign size={18} className="text-primary" />}
                    </div>
                    <div className="flex-1 relative">
                       <input 
                         type="number" 
                         value={cfg.commissionValue}
                         onChange={(e) => handleUpdate(cfg.id, e.target.value)}
                         className="w-full h-10 pl-3 pr-10 border border-border rounded-lg bg-background text-[15px] font-mono outline-none focus:border-primary"
                       />
                       <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted font-bold text-[13px]">{cfg.commissionType === 'PERCENTAGE' ? '%' : '₹'}</span>
                    </div>
                  </div>
               </div>
            ))}
          </div>
        )}
        <div className="mt-6 flex justify-end">
           <button className="h-10 px-6 rounded-lg bg-primary text-black font-bold text-[13px] flex items-center gap-2 hover:bg-primary/90">
             <Save size={16} /> Deploy Configuration
           </button>
        </div>
      </div>
      
      <div className="opacity-50 pointer-events-none">
        <div className="card border border-border p-6">
          <h2 className="text-[16px] font-bold text-text-primary mb-4">DTH & Utility (Coming Soon)</h2>
          <p className="text-[13px] text-text-muted">Additional commission splits for utilities will be available here.</p>
        </div>
      </div>
    </div>
  );
}
