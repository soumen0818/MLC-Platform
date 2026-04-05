import { useState } from 'react';
import { Power, Smartphone, Tv, Zap, ShieldCheck } from 'lucide-react';

export default function ServicesPage() {
  const [services, setServices] = useState([
    { id: '1', name: 'Prepaid Mobile', type: 'MOBILE', active: true, icon: <Smartphone size={20} /> },
    { id: '2', name: 'Postpaid Mobile', type: 'MOBILE', active: true, icon: <Smartphone size={20} /> },
    { id: '3', name: 'DTH Services', type: 'DTH', active: false, icon: <Tv size={20} /> },
    { id: '4', name: 'Electricity Bills', type: 'ELECTRICITY', active: false, icon: <Zap size={20} /> },
  ]);

  const toggleService = (id: string) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">API Providers & Services</h1>
        <p className="text-[14px] text-text-secondary mt-1">Control active platform services routing endpoints.</p>
      </div>

      <div className="card p-6 border border-border">
        <h2 className="text-[16px] font-bold text-text-primary flex items-center gap-2 mb-6"><ShieldCheck size={18} className="text-primary"/> Active Providers</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map(s => (
            <div key={s.id} className="p-4 border border-border rounded-xl flex items-center justify-between bg-background/50 hover:border-text-muted transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${s.active ? 'bg-primary/10 text-primary border-primary/20' : 'bg-background border-border text-text-muted'}`}>
                  {s.icon}
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-text-primary">{s.name}</h3>
                  <p className="text-[11px] text-text-secondary font-mono tracking-widest">{s.type}</p>
                </div>
              </div>
              
              <button 
                onClick={() => toggleService(s.id)}
                className={`flex gap-2 items-center px-4 py-1.5 rounded-full text-[12px] font-bold transition-all border ${s.active ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-background border-border text-text-muted'}`}
              >
                <Power size={14} /> {s.active ? 'ONLINE' : 'OFFLINE'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
