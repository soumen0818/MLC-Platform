import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { LayoutDashboard, Smartphone, Wallet, User, Network } from 'lucide-react';
import { ROLE_PATHS } from '@/types';

export default function MobileBottomNav() {
  const { user } = useAuthStore();
  if (!user) return null;

  const basePath = ROLE_PATHS[user.role];

  const items = [
    { icon: <LayoutDashboard size={20} />, label: 'Home', path: `${basePath}/dashboard` },
    ...(user.role === 'RETAILER'
      ? [{ icon: <Smartphone size={20} />, label: 'Recharge', path: `${basePath}/recharge` }]
      : [{ icon: <Network size={20} />, label: 'Network', path: `${basePath}/network` }]),
    { icon: <Wallet size={20} />, label: 'Wallet', path: `${basePath}/wallet` },
    { icon: <User size={20} />, label: 'Profile', path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors no-underline
              ${isActive ? 'text-primary' : 'text-text-muted hover:text-text-primary'}
            `}
          >
            <div className="[&>svg]:fill-none [&>svg]:stroke-current">{item.icon}</div>
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
