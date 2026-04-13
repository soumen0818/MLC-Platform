import { useState, useEffect } from 'react';
import { Power, Smartphone, Tv, Zap, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';

interface Service {
  id: string;
  name: string;
  serviceType: string;
  isActive: boolean;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const { data } = await api.get('/services');
      setServices(data.services || []);
    } catch (err) {
      console.error('Failed to load services:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleService = async (id: string, currentStatus: boolean) => {
    try {
      await api.patch(`/services/${id}`, { isActive: !currentStatus });
      setServices(prev => prev.map(s => s.id === id ? { ...s, isActive: !currentStatus } : s));
    } catch (err) {
      alert('Failed to update service status');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'MOBILE': return <Smartphone size={20} />;
      case 'DTH': return <Tv size={20} />;
      case 'ELECTRICITY': return <Zap size={20} />;
      default: return <Smartphone size={20} />;
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">API Providers & Services</h1>
        <p className="text-[14px] text-text-secondary mt-1">Control active platform services routing endpoints.</p>
      </div>

      <div className="card p-6 border border-border">
        <h2 className="text-[16px] font-bold text-text-primary flex items-center gap-2 mb-6"><ShieldCheck size={18} className="text-primary"/> Active Providers</h2>
        
        {loading ? (
          <p className="text-sm text-text-muted">Loading providers...</p>
        ) : services.length === 0 ? (
          <p className="text-sm text-text-muted">No providers configured in the database.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map(s => (
              <div key={s.id} className="p-4 border border-border rounded-xl flex items-center justify-between bg-background/50 hover:border-text-muted transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${s.isActive ? 'bg-primary/10 text-primary border-primary/20' : 'bg-background border-border text-text-muted'}`}>
                    {getIcon(s.serviceType)}
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-text-primary">{s.name}</h3>
                    <p className="text-[11px] text-text-secondary font-mono tracking-widest">{s.serviceType}</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => toggleService(s.id, s.isActive)}
                  className={`flex gap-2 items-center px-4 py-1.5 rounded-full text-[12px] font-bold transition-all border outline-none cursor-pointer ${s.isActive ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' : 'bg-background border-border text-text-muted hover:bg-border'}`}
                >
                  <Power size={14} /> {s.isActive ? 'ONLINE' : 'OFFLINE'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
