import { useAuthStore } from '@/stores/authStore';
import { formatCurrency } from '@/lib/utils';
import { Bell, Search, Menu } from 'lucide-react';
import { useState } from 'react';
import Sidebar from './Sidebar';

export default function Topbar() {
  const { user } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-zinc-200">
        <div className="flex items-center justify-between px-4 md:px-8 h-20">
          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-xl text-zinc-600 hover:bg-zinc-100 transition-colors"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={24} />
          </button>

          {/* Search */}
          <div className="hidden md:flex items-center gap-3 bg-zinc-100 rounded-xl px-4 py-3 w-96 border border-zinc-200/50 hover:border-zinc-300 transition-all">
            <Search size={18} className="text-zinc-400" />
            <input
              type="text"
              placeholder="Search components or records..."
              className="bg-transparent border-none outline-none text-sm flex-1 text-zinc-900 placeholder:text-zinc-400 font-medium"
            />
          </div>

          <div className="flex items-center gap-4">
            {/* Wallet Balance */}
            {user && (
              <div className="hidden sm:flex items-center gap-3 bg-zinc-900 text-white rounded-xl px-5 py-2.5 shadow-sm border border-black/5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#CCFF00] animate-pulse" />
                <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Wallet</span>
                <span className="text-sm font-bold font-mono tracking-tight text-[#CCFF00]">
                  {formatCurrency(user.walletBalance)}
                </span>
              </div>
            )}

            {/* Notifications */}
            <button className="relative p-3 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition-colors">
              <Bell size={20} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 shadow-2xl animate-slide-in z-50">
            <Sidebar />
          </div>
        </div>
      )}
    </>
  );
}
