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
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--color-border)] z-40">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                isActive
                  ? 'text-[var(--color-primary)]'
                  : 'text-[var(--color-text-muted)]'
              }`
            }
          >
            {item.icon}
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
