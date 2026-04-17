import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Save, IndianRupee, Smartphone, Tv, Zap } from 'lucide-react';

interface Config {
  id: string;
  role: string;
  serviceType: string;
  commissionType: 'PERCENTAGE' | 'FLAT';
  commissionValue: string | number;
}

type CategoryId = 'MOBILE' | 'DTH' | 'UTILITY';

interface ConfigOption {
  key: string;
  label: string;
  aliases?: string[];
}

interface Category {
  id: CategoryId;
  label: string;
  description: string;
  icon: typeof Smartphone;
  options: ConfigOption[];
}

const hierarchyOrder = ['STATE_HEAD', 'MASTER_DISTRIBUTOR', 'DISTRIBUTOR', 'RETAILER'];

const categories: Category[] = [
  {
    id: 'MOBILE',
    label: 'Mobile Recharge',
    description: 'Set separate commissions for each SIM provider.',
    icon: Smartphone,
    options: [
      { key: 'Jio', label: 'Jio' },
      { key: 'Airtel', label: 'Airtel' },
      { key: 'Vi', label: 'Vi', aliases: ['Vodafone'] },
      { key: 'BSNL', label: 'BSNL' },
    ],
  },
  {
    id: 'DTH',
    label: 'DTH Recharge',
    description: 'Set separate commissions for each DTH provider.',
    icon: Tv,
    options: [
      { key: 'TataSky', label: 'TataSky', aliases: ['Tata Play'] },
      { key: 'DishTV', label: 'DishTV', aliases: ['Dish TV'] },
      { key: 'Airtel DTH', label: 'Airtel DTH', aliases: ['Airtel'] },
    ],
  },
  {
    id: 'UTILITY',
    label: 'Utilities',
    description: 'Utility commissions stay service-based.',
    icon: Zap,
    options: [
      { key: 'ELECTRICITY', label: 'Electricity' },
      { key: 'GAS', label: 'Gas' },
      { key: 'WATER', label: 'Water' },
    ],
  },
];

function findMatchingConfig(allConfigs: any[], option: ConfigOption, role: string) {
  const candidates = [option.key, ...(option.aliases || [])];
  const matches = allConfigs.filter((config) => candidates.includes(config.serviceType) && config.role === role);

  return (
    matches.find((config) => config.serviceType === option.key) ||
    matches.find((config) => parseFloat(config.commissionValue || '0') > 0) ||
    matches[0]
  );
}

export default function CommissionPage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryId>('MOBILE');
  const [activeConfigKey, setActiveConfigKey] = useState('Jio');

  const activeCategoryMeta = useMemo(
    () => categories.find((category) => category.id === activeCategory) || categories[0],
    [activeCategory]
  );

  useEffect(() => {
    setActiveConfigKey(activeCategoryMeta.options[0]?.key || '');
  }, [activeCategoryMeta]);

  const fetchConfigs = async () => {
    try {
      const { data } = await api.get('/commission/configs');
      const mappedData = data?.configs || data || [];
      const allConfigs = Array.isArray(mappedData) ? mappedData : [];

      let idCounter = 1;
      const baseConfigs: Config[] = [];

      categories.forEach((category) => {
        category.options.forEach((option) => {
          hierarchyOrder.forEach((role) => {
            const existing = findMatchingConfig(allConfigs, option, role);
            baseConfigs.push({
              id: existing ? existing.id : `new-${idCounter++}`,
              role,
              serviceType: option.key,
              commissionType: existing ? existing.commissionType : 'FLAT',
              commissionValue: existing ? parseFloat(existing.commissionValue).toString() : '0',
            });
          });
        });
      });

      setConfigs(baseConfigs);
    } catch {
      let idCounter = 1;
      const baseConfigs: Config[] = [];

      categories.forEach((category) => {
        category.options.forEach((option) => {
          hierarchyOrder.forEach((role) => {
            baseConfigs.push({
              id: `new-${idCounter++}`,
              role,
              serviceType: option.key,
              commissionType: 'FLAT',
              commissionValue: '0',
            });
          });
        });
      });

      setConfigs(baseConfigs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfigs(); }, []);

  const handleUpdate = (id: string, value: string) => {
    setConfigs((prev) => prev.map((config) => (
      config.id === id ? { ...config, commissionValue: value, commissionType: 'FLAT' } : config
    )));
  };

  const handleDeploy = async () => {
    if (loading) {
      return;
    }

    const activeConfigs = configs.filter((config) => config.serviceType === activeConfigKey);
    if (activeConfigs.length === 0) {
      toast.error('No commission rows are ready yet for this provider.');
      return;
    }

    try {
      setLoading(true);
      await Promise.all(
        activeConfigs.map((config) =>
          api.post('/commission/configs', {
            serviceType: config.serviceType,
            role: config.role,
            commissionType: 'FLAT',
            commissionValue: parseFloat(config.commissionValue.toString()) || 0,
          })
        )
      );

      const activeOption = activeCategoryMeta.options.find((option) => option.key === activeConfigKey);
      toast.success(`${activeOption?.label || activeConfigKey} commissions deployed successfully.`);
      fetchConfigs();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to deploy configurations');
      setLoading(false);
    }
  };

  const activeOption = activeCategoryMeta.options.find((option) => option.key === activeConfigKey) || activeCategoryMeta.options[0];
  const visibleConfigs = configs.filter((config) => config.serviceType === activeConfigKey);

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Commission Engine</h1>
        <p className="text-[14px] text-text-secondary mt-1">Configure separate provider commissions for mobile and DTH, with service-based rules for utilities.</p>
      </div>

      <div className="card border border-border p-6">
        <div className="flex gap-3 mb-6 border-b border-border pb-4 overflow-x-auto scx">
          {categories.map((category) => {
            const Icon = category.icon;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                disabled={loading}
                className={`px-5 py-2 rounded-lg text-[13px] font-bold transition-all whitespace-nowrap flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${activeCategory === category.id ? 'bg-primary text-black shadow-md scale-105' : 'bg-background border border-border text-text-secondary hover:text-text-primary hover:border-text-muted'}`}
              >
                <Icon size={14} />
                {category.label}
              </button>
            );
          })}
        </div>

        <div className="mb-6 rounded-xl border border-border bg-background/50 px-4 py-3">
          <p className="text-[13px] font-semibold text-text-primary m-0">{activeCategoryMeta.label}</p>
          <p className="text-[12px] text-text-secondary mt-1">{activeCategoryMeta.description}</p>
          {activeCategory === 'DTH' && (
            <p className="text-[11px] text-text-muted mt-2">Airtel DTH config also matches recharge records coming in as `Airtel`.</p>
          )}
        </div>

        <div className="flex gap-3 mb-6 overflow-x-auto scx">
          {activeCategoryMeta.options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setActiveConfigKey(option.key)}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${activeConfigKey === option.key ? 'bg-text-primary text-white shadow-md' : 'bg-background border border-border text-text-secondary hover:text-text-primary hover:border-text-muted'}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-[13px] text-text-muted">Loading configuration tables...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {visibleConfigs.map((config) => (
              <div key={config.id} className="border border-border p-4 rounded-xl flex flex-col bg-background/30 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-[13px] font-bold text-text-secondary mb-3 uppercase tracking-wider">{config.role ? config.role.replace('_', ' ') : 'UNKNOWN TIER'}</h3>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-[#ccff00] border border-[#ccff00]/50 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(204,255,0,0.3)]">
                    <IndianRupee size={18} className="text-black" strokeWidth={3} />
                  </div>
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      step="0.01"
                      value={config.commissionValue}
                      onChange={(e) => handleUpdate(config.id, e.target.value)}
                      className="w-full h-10 pl-3 pr-10 border-2 border-border focus:border-[#ccff00] rounded-lg bg-background text-[15px] font-mono font-bold outline-none transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted font-bold text-[14px]">Rs</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleDeploy}
            disabled={loading || !activeOption}
            className="h-10 px-6 rounded-xl bg-primary text-black font-bold text-[13px] flex items-center gap-2 hover:bg-primary/90 transition-transform active:scale-95 disabled:opacity-50"
          >
            <Save size={16} /> {loading ? 'Deploying...' : `Deploy ${activeOption?.label || 'Configuration'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
