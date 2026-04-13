import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useSidebarStore } from '@/stores/sidebarStore';
import type { UserRole } from '@/types';
import { ROLE_LABELS } from '@/types';
import { getInitials } from '@/lib/utils';
import {
  LayoutDashboard, Users, Wallet, Smartphone, PieChart, Settings,
  FileText, ArrowDownUp, LogOut, Network, Send, ArrowUpRight,
  History, Award, Boxes
} from 'lucide-react';

interface NavItem { label: string; path: string; icon: React.ReactNode; }

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  SUPER_ADMIN: [
    { label: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'Users', path: '/admin/users', icon: <Users size={18} /> },
    { label: 'Commission Config', path: '/admin/commission', icon: <PieChart size={18} /> },
    { label: 'Wallet Management', path: '/admin/wallet', icon: <Wallet size={18} /> },
    { label: 'Withdrawals', path: '/admin/withdrawals', icon: <ArrowDownUp size={18} /> },
    { label: 'Recharges', path: '/admin/recharges', icon: <Smartphone size={18} /> },
    { label: 'Reports', path: '/admin/reports', icon: <FileText size={18} /> },
    { label: 'Services', path: '/admin/services', icon: <Boxes size={18} /> },
    { label: 'Settings', path: '/admin/settings', icon: <Settings size={18} /> },
  ],
  STATE_HEAD: [
    { label: 'Dashboard', path: '/state-head/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'My Network', path: '/state-head/network', icon: <Network size={18} /> },
    { label: 'Fund Transfer', path: '/state-head/fund-transfer', icon: <Send size={18} /> },
    { label: 'Topup Request', path: '/state-head/topup-request', icon: <ArrowUpRight size={18} /> },
    { label: 'Wallet', path: '/state-head/wallet', icon: <Wallet size={18} /> },
    { label: 'Commission', path: '/state-head/commission', icon: <Award size={18} /> },
    { label: 'Withdrawals', path: '/state-head/withdraw', icon: <ArrowDownUp size={18} /> },
  ],
  MASTER_DISTRIBUTOR: [
    { label: 'Dashboard', path: '/master/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'My Network', path: '/master/network', icon: <Network size={18} /> },
    { label: 'Fund Transfer', path: '/master/fund-transfer', icon: <Send size={18} /> },
    { label: 'Topup Request', path: '/master/topup-request', icon: <ArrowUpRight size={18} /> },
    { label: 'Wallet', path: '/master/wallet', icon: <Wallet size={18} /> },
    { label: 'Commission', path: '/master/commission', icon: <Award size={18} /> },
    { label: 'Withdrawals', path: '/master/withdraw', icon: <ArrowDownUp size={18} /> },
  ],
  DISTRIBUTOR: [
    { label: 'Dashboard', path: '/distributor/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'My Retailers', path: '/distributor/network', icon: <Network size={18} /> },
    { label: 'Fund Transfer', path: '/distributor/fund-transfer', icon: <Send size={18} /> },
    { label: 'Topup Request', path: '/distributor/topup-request', icon: <ArrowUpRight size={18} /> },
    { label: 'Wallet', path: '/distributor/wallet', icon: <Wallet size={18} /> },
    { label: 'Commission', path: '/distributor/commission', icon: <Award size={18} /> },
    { label: 'Withdrawals', path: '/distributor/withdraw', icon: <ArrowDownUp size={18} /> },
  ],
  RETAILER: [
    { label: 'Dashboard', path: '/retailer/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'Recharge', path: '/retailer/recharge', icon: <Smartphone size={18} /> },
    { label: 'History', path: '/retailer/history', icon: <History size={18} /> },
    { label: 'Wallet', path: '/retailer/wallet', icon: <Wallet size={18} /> },
    { label: 'Commission', path: '/retailer/commission', icon: <Award size={18} /> },
    { label: 'Topup Request', path: '/retailer/topup', icon: <ArrowUpRight size={18} /> },
    { label: 'Withdrawals', path: '/retailer/withdraw', icon: <ArrowDownUp size={18} /> },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { collapsed } = useSidebarStore();
  const navigate = useNavigate();
  if (!user) return null;

  const navItems = NAV_ITEMS[user.role] || [];
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="w-full h-screen bg-sidebar-bg flex flex-col font-sans transition-all duration-300 relative border-r border-sidebar-border">
      
      {/* Brand */}
      <div className={`h-[64px] flex items-center shrink-0 border-b border-sidebar-border transition-all duration-300 ${collapsed ? 'justify-center px-0' : 'justify-between px-5'}`}>
        {!collapsed ? (
          <div className="overflow-hidden">
            <h1 className="text-[16px] font-bold text-white tracking-tight m-0 leading-tight whitespace-nowrap">MLC Platform</h1>
            <p className="text-[9px] font-bold text-primary tracking-[0.15em] uppercase m-0 whitespace-nowrap">{ROLE_LABELS[user.role]}</p>
          </div>
        ) : (
          <div className="text-primary font-black text-[20px]">
            M
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 flex flex-col gap-1 hidden-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) => `
              flex items-center rounded-[10px] text-[13px] font-medium no-underline transition-all duration-200
              ${collapsed ? 'justify-center py-3' : 'justify-start gap-3 px-3.5 py-2.5'}
              ${isActive 
                ? 'bg-primary text-black shadow-[0_2px_8px_rgba(204,255,0,0.15)]' 
                : 'bg-transparent text-text-muted hover:bg-white/5 hover:text-white'}
            `}
          >
            <div className="shrink-0">{item.icon}</div>
            {!collapsed && <span className="overflow-hidden text-ellipsis whitespace-nowrap">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-2.5 border-t border-sidebar-border shrink-0">
        <div className={`flex items-center rounded-xl transition-all duration-300 group ${collapsed ? 'flex-col gap-2.5 py-2.5 px-0 hover:bg-white/5' : 'flex-row gap-2.5 p-2.5 hover:bg-white/10'}`}>
          
          <div 
            className="flex flex-1 items-center gap-2.5 cursor-pointer min-w-0" 
            onClick={() => navigate('/profile')}
            title="View Profile"
          >
            <div className="w-9 h-9 rounded-full bg-sidebar-border flex items-center justify-center text-white text-[12px] font-bold shrink-0 shadow-sm group-hover:border-primary/50 border border-transparent transition-colors">
              {getInitials(user.name)}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white m-0 overflow-hidden text-ellipsis whitespace-nowrap group-hover:text-primary transition-colors">{user.name || user.email.split('@')[0]}</p>
                <p className="text-[11px] text-text-muted m-0 overflow-hidden text-ellipsis whitespace-nowrap group-hover:text-text-secondary transition-colors">{user.email}</p>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-1.5 rounded-lg border-none bg-transparent text-text-muted cursor-pointer shrink-0 transition-all hover:text-red-500 hover:bg-red-500/10"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
