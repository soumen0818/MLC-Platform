import { useAuthStore } from '@/stores/authStore';
import { useSidebarStore } from '@/stores/sidebarStore';
import { formatCurrency } from '@/lib/utils';
import { Bell, Search, Menu, PanelLeftClose, PanelLeftOpen, Wallet } from 'lucide-react';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import api from '@/lib/api';

export default function Topbar() {
  const { user } = useAuthStore();
  const { collapsed, toggle } = useSidebarStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [totalBalance, setTotalBalance] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role === 'SUPER_ADMIN') return;
    
    const fetchBalance = async () => {
      try {
        const { data } = await api.get('/wallet/balance/full');
        setTotalBalance(data.totalBalance ?? data.mainBalance ?? null);
      } catch {
        // fallback to auth token value
        setTotalBalance(user.walletBalance);
      }
    };

    fetchBalance();
    // Refresh every 60 seconds to keep balance live
    const timer = setInterval(fetchBalance, 60_000);
    return () => clearInterval(timer);
  }, [user]);

  const displayBalance = totalBalance ?? user?.walletBalance ?? '0.00';

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-border font-sans">
        <div className="flex items-center justify-between px-6 h-[60px]">
          
          <div className="flex items-center gap-4">
            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-xl transition-all hover:bg-background text-text-secondary"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={22} />
            </button>

            {/* Desktop Sidebar Toggle */}
            <button
              className="hidden md:flex p-2 rounded-xl transition-all hover:bg-background text-text-secondary"
              onClick={toggle}
              title="Toggle Sidebar"
            >
              {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>

            {/* Search */}
            <div className="hidden md:flex items-center gap-2.5 bg-background border border-border rounded-xl px-3.5 py-2 w-[300px] transition-all focus-within:ring-[3px] focus-within:ring-primary/20 focus-within:border-primary focus-within:bg-white">
              <Search size={15} className="text-text-muted" />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent border-none outline-none text-[13px] flex-1 text-text-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Wallet Balance — total (main + commission) */}
            {user && user.role !== 'SUPER_ADMIN' && (
              <div className="hidden sm:flex items-center gap-2.5 bg-sidebar-bg border border-sidebar-border rounded-xl px-3.5 py-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Wallet size={13} className="text-primary" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-[0.1em]">Total Balance</span>
                  <span className="text-[14px] font-bold text-primary font-mono tracking-tight">
                    {totalBalance === null
                      ? <span className="text-[11px] text-text-muted animate-pulse">Loading...</span>
                      : formatCurrency(displayBalance)
                    }
                  </span>
                </div>
              </div>
            )}

            {/* Bell */}
            <button className="relative p-2 rounded-xl border border-border hover:bg-background transition-all text-text-secondary">
              <Bell size={17} />
              <span className="absolute top-[6px] right-[6px] w-[7px] h-[7px] rounded-full bg-red-500 border-2 border-white" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-0 left-0 bottom-0 w-[272px] bg-sidebar-bg z-50 shadow-[4px_0_24px_rgba(0,0,0,0.2)] animate-slide-in">
            <Sidebar />
          </div>
        </div>
      )}
    </>
  );
}
