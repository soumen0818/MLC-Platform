import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Save, IndianRupee } from 'lucide-react';

interface Config {
  id: string;
  role: string;
  serviceType: string;
  commissionType: 'PERCENTAGE' | 'FLAT';
  commissionValue: string | number;
}

const hierarchyOrder = ['STATE_HEAD', 'MASTER_DISTRIBUTOR', 'DISTRIBUTOR', 'RETAILER'];
const providers = ['Jio', 'Airtel', 'Vi', 'BSNL', 'TataSky', 'DishTV', 'Airtel DTH'];

export default function CommissionPage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProvider, setActiveProvider] = useState('Jio');

  const fetchConfigs = async () => {
    try {
      const { data } = await api.get('/commission/configs');
      const mappedData = data?.configs || data || [];
      
      let idCounter = 1;
      const baseConfigs: Config[] = [];
      providers.forEach(op => {
        hierarchyOrder.forEach(role => {
          const existing = (Array.isArray(mappedData) ? mappedData : []).find(
            (c: any) => c.serviceType === op && c.role === role
          );
          baseConfigs.push({
             id: existing ? existing.id : `new-${idCounter++}`,
             role,
             serviceType: op,
             commissionType: existing ? existing.commissionType : 'FLAT',
             commissionValue: existing ? parseFloat(existing.commissionValue).toString() : '0'
          });
        });
      });
      setConfigs(baseConfigs);
    } catch {
      let idCounter = 1;
      const baseConfigs: Config[] = [];
      providers.forEach(op => {
        hierarchyOrder.forEach(role => {
          baseConfigs.push({
             id: `new-${idCounter++}`,
             role,
             serviceType: op,
             commissionType: 'FLAT',
             commissionValue: '0'
          });
        });
      });
      setConfigs(baseConfigs);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchConfigs(); }, []);

  const handleUpdate = (id: string, value: string) => {
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, commissionValue: value, commissionType: 'FLAT' } : c));
  };

  const handleDeploy = async () => {
    try {
      setLoading(true);
      const activeConfigs = configs.filter(c => c.serviceType === activeProvider);
      await Promise.all(
        activeConfigs.map(cfg => 
          api.post('/commission/configs', {
            serviceType: cfg.serviceType,
            role: cfg.role,
            commissionType: 'FLAT', // Force flat money amount
            commissionValue: parseFloat(cfg.commissionValue.toString()) || 0
          })
        )
      );
      toast.success(`${activeProvider} configurations securely deployed to network!`);
      fetchConfigs();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to deploy configurations');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Commission Engine</h1>
        <p className="text-[14px] text-text-secondary mt-1">Configure global flat money payouts (₹) per tier.</p>
      </div>

      <div className="card border border-border p-6">
        <div className="flex gap-3 mb-6 border-b border-border pb-4 overflow-x-auto scx">
          {providers.map(p => (
            <button 
              key={p} 
              onClick={() => setActiveProvider(p)}
              className={`px-5 py-2 rounded-lg text-[13px] font-bold transition-all whitespace-nowrap ${activeProvider === p ? 'bg-primary text-black shadow-md scale-105' : 'bg-background border border-border text-text-secondary hover:text-text-primary hover:border-text-muted'}`}
            >
              {p}
            </button>
          ))}
        </div>
        
        {loading ? (
          <p className="text-[13px] text-text-muted">Loading configuration tables...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {configs.filter(c => c.serviceType === activeProvider).map(cfg => (
               <div key={cfg.id} className="border border-border p-4 rounded-xl flex flex-col bg-background/30 shadow-sm hover:shadow-md transition-shadow">
                  <h3 className="text-[13px] font-bold text-text-secondary mb-3 uppercase tracking-wider">{cfg.role ? cfg.role.replace('_', ' ') : 'UNKNOWN TIER'}</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-[#ccff00] border border-[#ccff00]/50 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(204,255,0,0.3)]">
                      <IndianRupee size={18} className="text-black" strokeWidth={3} />
                    </div>
                    <div className="flex-1 relative">
                       <input 
                         type="number" 
                         step="0.01"
                         value={cfg.commissionValue}
                         onChange={(e) => handleUpdate(cfg.id, e.target.value)}
                         className="w-full h-10 pl-3 pr-10 border-2 border-border focus:border-[#ccff00] rounded-lg bg-background text-[15px] font-mono font-bold outline-none transition-colors"
                       />
                       <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted font-bold text-[14px]">₹</span>
                    </div>
                  </div>
               </div>
            ))}
          </div>
        )}
        <div className="mt-6 flex justify-end">
           <button 
             onClick={handleDeploy} 
             disabled={loading}
             className="h-10 px-6 rounded-xl bg-primary text-black font-bold text-[13px] flex items-center gap-2 hover:bg-primary/90 transition-transform active:scale-95 disabled:opacity-50"
           >
             <Save size={16} /> {loading ? 'Deploying...' : 'Deploy Configuration'}
           </button>
        </div>
      </div>
      
      <div className="opacity-50 pointer-events-none">
        <div className="card border border-border p-6 shadow-sm">
          <h2 className="text-[16px] font-bold text-text-primary mb-4">DTH & Utility (Coming Soon)</h2>
          <p className="text-[13px] text-text-muted">Additional commission splits for utilities will be available here.</p>
        </div>
      </div>
    </div>
  );
}
