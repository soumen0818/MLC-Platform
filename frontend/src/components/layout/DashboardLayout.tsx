import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileBottomNav from './MobileBottomNav';
import { useSidebarStore } from '@/stores/sidebarStore';

export default function DashboardLayout() {
  const { collapsed } = useSidebarStore();

  const sidebarWidthClass = collapsed ? "w-[80px]" : "w-[272px]";
  const marginClass = collapsed ? "md:ml-[80px]" : "md:ml-[272px]";

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

            <Outlet />
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
