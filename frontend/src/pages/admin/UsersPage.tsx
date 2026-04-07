import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { UserPlus, Search, UserCheck, ShieldAlert, ArrowRight, X, Eye, EyeOff } from 'lucide-react';

interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  walletBalance: string;
  isActive: boolean;
  kycStatus: string;
  createdAt: string;
}

const UsersPage = () => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  // Form
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('STATE_HEAD');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data.users || []);
    } catch {
      setUsers([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast.error('Please enter a strictly valid email address.');
      return;
    }
    
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/users', { email, password, role });
      toast.success('Account provisioned successfully! Waiting for user to activate it.');
      setShowAdd(false);
      setEmail('');
      setPassword('');
      fetchUsers();
    } catch (err: any) {
      if (err.response?.data?.details) {
        toast.error("Validation error: " + err.response.data.details[0].message);
      } else {
        toast.error(err.response?.data?.error || 'Failed to create user');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const displayUsers = users.filter((u: any) => u.role !== 'SUPER_ADMIN');

  return (
    <div className="flex flex-col gap-6 font-sans relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Directory</h1>
          <p className="text-[14px] text-text-secondary mt-1">Manage network users, monitor balances, and provision accounts.</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-black font-bold text-[13px] tracking-wide hover:bg-primary/90 transition-colors">
          <UserPlus size={16} /> New User
        </button>
      </div>

      {showAdd && (
        <div className="card p-6 border border-primary/30 shadow-[0_4px_24px_rgba(204,255,0,0.05)]">
          <h2 className="text-[16px] font-bold text-text-primary mb-4">Provision New Account</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-[12px] font-semibold text-text-secondary mb-1">Email</label>
              <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user@example.com" className="w-full h-10 px-3 border border-border rounded-lg bg-background text-[13px] outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-text-secondary mb-1">Password</label>
              <div className="relative">
                <input required type={showPassword ? "text" : "password"} minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min 6 chars" className="w-full h-10 px-3 pr-10 border border-border rounded-lg bg-background text-[13px] outline-none focus:border-primary" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-text-secondary mb-1">Assigned Role</label>
              <select required value={role} onChange={e=>setRole(e.target.value)} className="w-full h-10 px-3 border border-border rounded-lg bg-background text-[13px] font-medium outline-none focus:border-primary">
                <option value="STATE_HEAD">State Head</option>
                <option value="MASTER_DISTRIBUTOR">Master Dist.</option>
                <option value="DISTRIBUTOR">Distributor</option>
                <option value="RETAILER">Retailer</option>
              </select>
            </div>
            <button disabled={submitting} type="submit" className="h-10 rounded-lg bg-primary text-black font-bold text-[13px] transition hover:bg-primary/90 disabled:opacity-70">
              {submitting ? 'Authenticating...' : 'Confirm'}
            </button>
          </form>
        </div>
      )}

      <div className="card border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between bg-background/50">
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input placeholder="Search users by ID/Phone..." className="w-full h-9 pl-9 pr-3 text-[12px] bg-background border border-border rounded-lg outline-none focus:border-primary" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-background text-[11px] uppercase tracking-wider text-text-secondary border-b border-border">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Wallet</th>
                <th className="py-3 px-4">Security & KYC</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-[13px] text-text-muted">Scanning network...</td></tr>
              ) : displayUsers.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-[13px] text-text-muted">No downline users detected.</td></tr>
              ) : displayUsers.map(u => (
                <tr key={u.id} className="hover:bg-background/50 transition-colors">
                  <td className="py-3 px-4">
                    <p className="text-[13px] font-bold text-text-primary">{u.name}</p>
                    <p className="text-[11px] text-text-muted font-mono mt-0.5">{u.id.slice(0,8)}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-[13px] text-text-primary">{u.phone}</p>
                    <p className="text-[12px] text-text-secondary">{u.email}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[11px] font-bold bg-background border border-border px-1.5 py-0.5 rounded">{u.role.replace('_', ' ')}</span>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-[13px] font-bold">₹{u.walletBalance}</p>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-1.5 items-center">
                        {u.isActive ? <UserCheck size={13} className="text-emerald-500" /> : <ShieldAlert size={13} className="text-amber-500" />}
                        <span className={`text-[11px] font-bold ${u.isActive ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {u.isActive ? 'ACCEPTED' : 'PENDING CLAIM'}
                        </span>
                      </div>
                      <span className="text-[10px] text-text-muted font-medium tracking-wide">KYC: {u.kycStatus}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => setSelectedUser(u)} className="text-text-secondary hover:text-primary transition-colors"><ArrowRight size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Slide Panel */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
          <div className="w-[400px] max-w-[90vw] bg-white border-l border-gray-200 h-full p-6 overflow-y-auto font-sans shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[18px] font-bold text-gray-900">Node Specifications</h2>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-[20px] font-bold text-gray-800 border border-gray-200 shadow-sm">
                {(selectedUser.name && selectedUser.name.charAt(0)) || 'U'}
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-gray-900">{selectedUser.name || 'Undefined'}</h3>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-gray-200 text-gray-600 mt-1.5 inline-block bg-gray-50 shadow-sm">{selectedUser.role.replace('_', ' ')}</span>
              </div>
            </div>

            <div className="space-y-6 text-[13px]">
              <div>
                <label className="text-[12px] font-bold uppercase tracking-wider text-gray-500 mb-2 block">Contact Logs</label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center"><span className="text-gray-500 font-medium">Address:</span><span className="text-gray-900 font-mono text-[12px] select-all">{selectedUser.email}</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-500 font-medium">Telecom:</span><span className="text-gray-900 font-mono text-[12px] select-all">{selectedUser.phone || 'N/A'}</span></div>
                </div>
              </div>

              <div>
                <label className="text-[12px] font-bold uppercase tracking-wider text-gray-500 mb-2 block">Ledger Analytics</label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center"><span className="text-gray-500 font-medium">Fluid Liquidity:</span><span className="text-black font-mono font-bold text-[15px]">₹{selectedUser.walletBalance || '0.00'}</span></div>
                </div>
              </div>

              <div>
                <label className="text-[12px] font-bold uppercase tracking-wider text-gray-500 mb-2 block">Network Status</label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Authorization:</span>
                    <span className={`${selectedUser.isActive ? 'text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded' : 'text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded'}`}>{selectedUser.isActive ? 'ACTIVE' : 'LOCKED'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">KYC Clearing:</span>
                    <span className="text-gray-900 font-mono font-semibold">{selectedUser.kycStatus}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Initialized:</span>
                    <span className="text-gray-600 font-mono text-[12px]">{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
