import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileBottomNav from './MobileBottomNav';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useAuthStore } from '@/stores/authStore';
import { AlertCircle } from 'lucide-react';

export default function DashboardLayout() {
  const { collapsed } = useSidebarStore();
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const sidebarWidthClass = collapsed ? "w-[80px]" : "w-[272px]";
  const marginClass = collapsed ? "md:ml-[80px]" : "md:ml-[272px]";

  const isProfilePage = location.pathname.includes('/profile');
  // Secure lock if the user is an MLM tier and their identity verification is unapproved
  const kycLocked = user?.role !== 'SUPER_ADMIN' && user?.kycStatus !== 'APPROVED' && !isProfilePage;

  return (
    <div className="min-h-screen bg-background font-sans text-text-primary">
      {/* Sidebar — hidden on mobile */}
      <aside
        className={`hidden md:flex fixed top-0 left-0 ${sidebarWidthClass} h-screen z-50 transition-all duration-300 ease-in-out`}
      >
        <Sidebar />
      </aside>

      {/* Main Content Area */}
      <div className={`min-h-screen flex flex-col transition-all duration-300 ease-in-out ${marginClass}`}>
        <Topbar />
        <main className="flex-1 p-6 pb-24 md:px-8 lg:px-10">
          <div className="w-full max-w-[1400px] mx-auto relative">

            {user?.role !== 'SUPER_ADMIN' && user?.kycStatus !== 'APPROVED' && (
              <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <AlertCircle className="text-amber-500" size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="text-[15px] font-bold text-amber-500 m-0">Identity Verification (KYC) Required</h3>
                  <p className="text-[13px] text-amber-500/90 mt-1 max-w-[650px] leading-relaxed font-medium">
                    For security reasons, your platform modules remain heavily restricted. You must submit your KYC identity documents and await Super Admin approval to activate your digital wallet and authorize network features.
                  </p>
                  {!isProfilePage && (
                    <button
                      onClick={() => navigate('/profile')}
                      className="mt-3 px-5 py-2.5 bg-amber-500 text-black font-bold text-[12px] rounded-lg border-none cursor-pointer hover:bg-amber-600 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all">
                      Launch Identity Verification
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* If KYC Locked, smoothly blur out and disable interaction with the raw internal routes */}
            <div className={kycLocked ? 'opacity-30 pointer-events-none select-none blur-[3px] transition-all duration-500 ease-out' : 'transition-all duration-300'}>
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden">
        <MobileBottomNav />
      </div>
    </div>
  );
}
