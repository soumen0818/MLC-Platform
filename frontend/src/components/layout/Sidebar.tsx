import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types';
import { ROLE_LABELS } from '@/types';
import { getInitials } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Wallet,
  Smartphone,
  PieChart,
  Settings,
  FileText,
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Network,
  Send,
  ArrowUpRight,
  History,
  Award,
  FileCheck,
  Boxes
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  SUPER_ADMIN: [
    { label: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'Users', path: '/admin/users', icon: <Users size={20} /> },
    { label: 'Commission Config', path: '/admin/commission', icon: <PieChart size={20} /> },
    { label: 'Wallet Management', path: '/admin/wallet', icon: <Wallet size={20} /> },
    { label: 'Withdrawals', path: '/admin/withdrawals', icon: <ArrowDownUp size={20} /> },
    { label: 'Recharges', path: '/admin/recharges', icon: <Smartphone size={20} /> },
    { label: 'KYC Review', path: '/admin/kyc', icon: <FileCheck size={20} /> },
    { label: 'Reports', path: '/admin/reports', icon: <FileText size={20} /> },
    { label: 'Services', path: '/admin/services', icon: <Boxes size={20} /> },
    { label: 'Settings', path: '/admin/settings', icon: <Settings size={20} /> },
  ],
  STATE_HEAD: [
    { label: 'Dashboard', path: '/state-head/dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'My Network', path: '/state-head/network', icon: <Network size={20} /> },
    { label: 'Fund Transfer', path: '/state-head/fund-transfer', icon: <Send size={20} /> },
    { label: 'Topup Request', path: '/state-head/topup-request', icon: <ArrowUpRight size={20} /> },
    { label: 'Wallet', path: '/state-head/wallet', icon: <Wallet size={20} /> },
    { label: 'Commission', path: '/state-head/commission', icon: <Award size={20} /> },
    { label: 'Withdrawals', path: '/state-head/withdraw', icon: <ArrowDownUp size={20} /> },
  ],
  MASTER_DISTRIBUTOR: [
    { label: 'Dashboard', path: '/master/dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'My Network', path: '/master/network', icon: <Network size={20} /> },
    { label: 'Fund Transfer', path: '/master/fund-transfer', icon: <Send size={20} /> },
    { label: 'Topup Request', path: '/master/topup-request', icon: <ArrowUpRight size={20} /> },
    { label: 'Wallet', path: '/master/wallet', icon: <Wallet size={20} /> },
    { label: 'Commission', path: '/master/commission', icon: <Award size={20} /> },
    { label: 'Withdrawals', path: '/master/withdraw', icon: <ArrowDownUp size={20} /> },
  ],
  DISTRIBUTOR: [
    { label: 'Dashboard', path: '/distributor/dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'My Retailers', path: '/distributor/network', icon: <Network size={20} /> },
    { label: 'Fund Transfer', path: '/distributor/fund-transfer', icon: <Send size={20} /> },
    { label: 'Topup Request', path: '/distributor/topup-request', icon: <ArrowUpRight size={20} /> },
    { label: 'Wallet', path: '/distributor/wallet', icon: <Wallet size={20} /> },
    { label: 'Commission', path: '/distributor/commission', icon: <Award size={20} /> },
    { label: 'Withdrawals', path: '/distributor/withdraw', icon: <ArrowDownUp size={20} /> },
  ],
  RETAILER: [
    { label: 'Dashboard', path: '/retailer/dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'Recharge', path: '/retailer/recharge', icon: <Smartphone size={20} /> },
    { label: 'History', path: '/retailer/history', icon: <History size={20} /> },
    { label: 'Wallet', path: '/retailer/wallet', icon: <Wallet size={20} /> },
    { label: 'Commission', path: '/retailer/commission', icon: <Award size={20} /> },
    { label: 'Topup Request', path: '/retailer/topup', icon: <ArrowUpRight size={20} /> },
    { label: 'Withdrawals', path: '/retailer/withdraw', icon: <ArrowDownUp size={20} /> },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();

  if (!user) return null;

  const navItems = NAV_ITEMS[user.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className={`fixed top-0 left-0 h-screen bg-[#0A0A0A] text-zinc-400 z-50 flex flex-col transition-all duration-300 shadow-xl ${isCollapsed ? 'w-20' : 'w-72'}`}>
      {/* Brand / Logo */}
      <div className="h-20 px-6 flex items-center border-b border-zinc-800 shrink-0">
        {!isCollapsed && (
          <div className="flex flex-col truncate w-full">
            <h1 className="text-xl font-bold font-display text-white tracking-tight">MLC Platform</h1>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#CCFF00] mt-0.5">{ROLE_LABELS[user.role]}</p>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-6 px-3 overflow-y-auto hidden-scrollbar space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-[#CCFF00] text-black shadow-[0_4px_12px_rgba(204,255,0,0.15)]' 
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`
            }
            title={isCollapsed ? item.label : undefined}
          >
            <div className={`${isCollapsed ? 'mx-auto' : ''}`}>{item.icon}</div>
            {!isCollapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="hidden lg:flex items-center justify-center mx-4 p-3 mb-4 rounded-xl text-zinc-500 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-colors"
      >
        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        {!isCollapsed && <span className="ml-2 text-sm font-medium">Collapse Menu</span>}
      </button>

      {/* User Profile */}
      <div className="p-4 border-t border-zinc-800 shrink-0 bg-zinc-900/50 m-2 rounded-2xl">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 text-white font-semibold text-sm">
            {getInitials(user.name)}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-xs text-zinc-500 truncate">{user.email}</p>
            </div>
          )}
          {!isCollapsed && (
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
