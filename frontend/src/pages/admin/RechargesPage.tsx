import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { CheckCircle2, Clock, Smartphone, Tv, XCircle, Zap } from 'lucide-react';
import type { RechargePlan, RechargeProviderDescriptor } from '@/types';

interface RechargeTxn {
  id: string;
  mobileNumber: string;
  operator: string;
  serviceType: string;
  amount: string;
  apiProvider?: string | null;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  createdAt: string;
  failureReason?: string;
}

const OPERATOR_OPTIONS: Record<string, string[]> = {
  MOBILE: ['Jio', 'Airtel', 'Vi', 'BSNL'],
  DTH: ['TataSky', 'DishTV', 'Airtel'],
  ELECTRICITY: ['Electricity Board'],
};

function formatProviderName(providerId?: string | null): string {
  if (!providerId) {
    return 'Unknown';
  }

  if (providerId === 'bharatpays') return 'BharatPays';
  if (providerId === 'setu') return 'Setu';
  return providerId;
}

export default function RechargesPage() {
  const { user, fetchMe } = useAuthStore();
  const [transactions, setTransactions] = useState<RechargeTxn[]>([]);
  const [providers, setProviders] = useState<RechargeProviderDescriptor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [providersLoading, setProvidersLoading] = useState(true);

  const [mobile, setMobile] = useState('');
  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('');
  const [circle, setCircle] = useState('');
  const [serviceType, setServiceType] = useState<'MOBILE' | 'DTH' | 'ELECTRICITY' | 'GAS' | 'WATER'>('MOBILE');
  const [selectedProvider, setSelectedProvider] = useState<'bharatpays' | 'setu'>('bharatpays');
  const [plans, setPlans] = useState<RechargePlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [plansLoading, setPlansLoading] = useState(false);
  const [planError, setPlanError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedProviderMeta = useMemo(
    () => providers.find((provider) => provider.id === selectedProvider),
    [providers, selectedProvider]
  );

  const availableOperators = OPERATOR_OPTIONS[serviceType] || [];
  const canLoadSetuPlans =
    selectedProvider === 'setu' &&
    selectedProviderMeta?.supportsPlanLookup &&
    ['MOBILE', 'DTH'].includes(serviceType) &&
    Boolean(operator);

  const fetchProviders = async () => {
    setProvidersLoading(true);
    try {
      const { data } = await api.get('/recharge/providers');
      const providerList = (data.providers || []) as RechargeProviderDescriptor[];
      setProviders(providerList);

      const firstActive = providerList.find((provider) => provider.active) || providerList[0];
      if (firstActive?.id) {
        setSelectedProvider(firstActive.id);
      }
    } catch (error) {
      console.error('Failed to load recharge providers:', error);
      setProviders([]);
    } finally {
      setProvidersLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const endpoint = user?.role === 'SUPER_ADMIN' ? '/recharge/all' : '/recharge/history';
      const { data } = await api.get(endpoint);
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Failed to load recharge transactions:', error);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  useEffect(() => {
    setPlans([]);
    setSelectedPlanId('');
    setPlanError('');
    if (selectedProvider !== 'setu') {
      setCircle('');
    }
  }, [selectedProvider, serviceType, operator]);

  const loadPlans = async () => {
    if (!canLoadSetuPlans) {
      return;
    }

    setPlansLoading(true);
    setPlanError('');

    try {
      const { data } = await api.get('/recharge/plans', {
        params: {
          provider: 'setu',
          serviceType,
          operator,
          mobileNumber: mobile || undefined,
          circle: circle || undefined,
        },
      });

      setPlans(data.plans || []);
      if (!data.plans?.length) {
        setPlanError('No plans returned for this operator yet. You can still recharge manually if your Setu biller allows it.');
      }
    } catch (error: any) {
      setPlans([]);
      setPlanError(error.response?.data?.error || 'Failed to load Setu plans');
    } finally {
      setPlansLoading(false);
    }
  };

  const handlePlanSelection = (planId: string) => {
    setSelectedPlanId(planId);
    const plan = plans.find((item) => item.id === planId);
    if (plan?.amount) {
      setAmount(plan.amount);
    }
  };

  const handleRecharge = async (e: FormEvent) => {
    e.preventDefault();

    if (!mobile || !amount || !operator) {
      alert('Please fill all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await api.post('/recharge', {
        provider: selectedProvider,
        mobileNumber: mobile,
        operator,
        serviceType,
        amount: parseFloat(amount),
        circle: circle || undefined,
        planId: selectedPlanId || undefined,
      });

      alert(`Recharge ${data.status}: ${data.message}`);
      setMobile('');
      setAmount('');
      setOperator('');
      setCircle('');
      setPlans([]);
      setSelectedPlanId('');
      fetchTransactions();
      fetchMe();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Recharge failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user?.role === 'RETAILER') {
    return (
      <div className="flex flex-col gap-6 font-sans">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Recharge Hub</h1>
          <p className="text-[14px] text-text-secondary mt-1">Multi-provider recharge terminal with BharatPays live fallback and Setu plan flow support.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6 border-2 border-primary/20 shadow-[0_8px_32px_rgba(204,255,0,0.05)]">
            <div className="mb-5">
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Recharge Provider</label>
              <div className="flex gap-3 flex-wrap">
                {providersLoading ? (
                  <p className="text-[13px] text-text-muted">Loading providers...</p>
                ) : providers.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => provider.active && setSelectedProvider(provider.id)}
                    className={`relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all ${
                      selectedProvider === provider.id
                        ? 'border-emerald-500 bg-emerald-500/15 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                        : provider.active
                          ? 'border-border bg-background hover:border-text-muted cursor-pointer'
                          : 'border-border bg-background opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${selectedProvider === provider.id ? 'bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]' : provider.active ? 'bg-text-muted' : 'bg-border'}`} />
                    <span className={`text-[13px] font-bold ${selectedProvider === provider.id ? 'text-emerald-600' : 'text-text-secondary'}`}>{provider.name}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${selectedProvider === provider.id ? 'bg-emerald-500 text-white' : 'bg-background border border-border text-text-muted'}`}>{provider.tag}</span>
                    {!provider.active && <span className="text-[9px] text-text-muted font-bold">SETUP</span>}
                  </button>
                ))}
              </div>
              {selectedProviderMeta?.message && (
                <p className="text-[12px] text-text-muted mt-2">{selectedProviderMeta.message}</p>
              )}
            </div>

            <div className="flex gap-4 mb-6 relative z-10">
              <button onClick={() => setServiceType('MOBILE')} className={`flex flex-col items-center justify-center p-3 rounded-xl border flex-1 transition-colors ${serviceType === 'MOBILE' ? 'bg-primary text-black border-primary' : 'bg-background border-border text-text-secondary hover:border-text-muted'}`}>
                <Smartphone size={24} className="mb-2" />
                <span className="text-[12px] font-bold uppercase tracking-wider">Mobile</span>
              </button>
              <button onClick={() => setServiceType('DTH')} className={`flex flex-col items-center justify-center p-3 rounded-xl border flex-1 transition-colors ${serviceType === 'DTH' ? 'bg-primary text-black border-primary' : 'bg-background border-border text-text-secondary hover:border-text-muted'}`}>
                <Tv size={24} className="mb-2" />
                <span className="text-[12px] font-bold uppercase tracking-wider">DTH</span>
              </button>
              <button onClick={() => setServiceType('ELECTRICITY')} className={`flex flex-col items-center justify-center p-3 rounded-xl border flex-1 transition-colors ${serviceType === 'ELECTRICITY' ? 'bg-primary text-black border-primary' : 'bg-background border-border text-text-secondary hover:border-text-muted'}`}>
                <Zap size={24} className="mb-2" />
                <span className="text-[12px] font-bold uppercase tracking-wider">Electric</span>
              </button>
            </div>

            <form onSubmit={handleRecharge} className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">{serviceType === 'MOBILE' ? 'Mobile Number' : 'Subscriber/Account ID'}</label>
                <input
                  required
                  type="text"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-background focus:border-primary text-lg font-mono outline-none"
                  placeholder={serviceType === 'MOBILE' ? '9876543210' : 'Account / Subscriber ID'}
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-[2]">
                  <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Operator</label>
                  <select
                    required
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    className="w-full h-12 px-3 rounded-xl border border-border bg-background focus:border-primary outline-none font-medium"
                  >
                    <option value="" disabled>Select Operator</option>
                    {availableOperators.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-[1]">
                  <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Amount (₹)</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full h-12 px-3 rounded-xl border border-border bg-background focus:border-primary font-bold text-lg outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {selectedProvider === 'setu' && (
                <div>
                  <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Circle / Region</label>
                  <input
                    type="text"
                    value={circle}
                    onChange={(e) => setCircle(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border border-border bg-background focus:border-primary outline-none"
                    placeholder="Delhi, UP East, Karnataka..."
                  />
                  <p className="text-[11px] text-text-muted mt-1">Setu billers often need circle/region for mobile and DTH validation.</p>
                </div>
              )}

              {selectedProvider === 'setu' && (
                <div className="rounded-xl border border-border bg-background/50 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-[13px] font-semibold text-text-primary m-0">Setu Plans</p>
                      <p className="text-[11px] text-text-muted mt-1">Load plans when your Setu biller uses plan catalog support.</p>
                    </div>
                    <button
                      type="button"
                      disabled={!canLoadSetuPlans || plansLoading}
                      onClick={loadPlans}
                      className="px-3 py-2 rounded-lg border border-border bg-white text-[12px] font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {plansLoading ? 'Loading...' : 'Load Plans'}
                    </button>
                  </div>

                  {plans.length > 0 && (
                    <select
                      value={selectedPlanId}
                      onChange={(e) => handlePlanSelection(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-border bg-background outline-none"
                    >
                      <option value="">Select a plan</option>
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          ₹{plan.amount} - {plan.description}
                        </option>
                      ))}
                    </select>
                  )}

                  {planError && <p className="text-[11px] text-amber-600 mt-2">{planError}</p>}
                </div>
              )}

              <button
                disabled={isSubmitting || !selectedProviderMeta?.active}
                type="submit"
                className="w-full h-14 mt-4 bg-text-primary text-background rounded-xl text-[16px] font-bold uppercase tracking-widest hover:bg-black transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Processing...' : `Execute via ${selectedProviderMeta?.name || 'Provider'}`}
              </button>
            </form>
          </div>

          <div className="card p-6">
            <h2 className="text-[16px] font-bold text-text-primary mb-4">Today's Terminal Logs</h2>
            <div className="space-y-3">
              {isLoading ? <p className="text-[13px] text-text-muted">Loading...</p> : transactions.map((txn) => (
                <div key={txn.id} className="p-3 border border-border rounded-xl flex items-center justify-between">
                  <div className="flex gap-3 items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${txn.status === 'SUCCESS' ? 'bg-green-100 text-green-600' : txn.status === 'FAILED' || txn.status === 'REFUNDED' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                      {txn.status === 'SUCCESS' ? <CheckCircle2 size={18} /> : txn.status === 'FAILED' || txn.status === 'REFUNDED' ? <XCircle size={18} /> : <Clock size={18} />}
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-text-primary leading-tight font-mono">{txn.mobileNumber}</p>
                      <p className="text-[12px] text-text-secondary">{txn.operator} · {formatProviderName(txn.apiProvider)} · {new Date(txn.createdAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-bold text-text-primary">₹{txn.amount}</p>
                    <p className="text-[11px] font-semibold text-text-secondary">{txn.status}</p>
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

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Network Recharges</h1>
        <p className="text-[14px] text-text-secondary mt-1">View multi-provider recharge transaction logs across the network.</p>
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
              ) : transactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-table-hover transition-colors">
                  <td className="py-4 px-5">
                    <p className="text-[14px] font-bold font-mono">{txn.mobileNumber}</p>
                    <p className="text-[12px] text-text-secondary">{txn.operator}</p>
                  </td>
                  <td className="py-4 px-5">
                    <p className="text-[14px] font-bold text-text-primary">₹{txn.amount}</p>
                  </td>
                  <td className="py-4 px-5">
                    <span className="text-[12px] border border-border bg-background px-1.5 py-0.5 rounded text-text-secondary">{txn.serviceType}</span>
                    <p className="text-[12px] text-text-muted mt-1">{formatProviderName(txn.apiProvider)} · {new Date(txn.createdAt).toLocaleString()}</p>
                  </td>
                  <td className="py-4 px-5">
                    <span className={`px-2 py-1 rounded text-[11px] font-bold ${txn.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : txn.status === 'SUCCESS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {txn.status}
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
