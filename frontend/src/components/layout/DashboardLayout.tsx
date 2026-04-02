import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileBottomNav from './MobileBottomNav';

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-zinc-50 font-body">
      {/* Sidebar — hidden on mobile, fixed on md+ */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main Content Area — offset by sidebar width on md+ */}
      <div className="md:ml-72 min-h-screen flex flex-col">
        <Topbar />
        <main className="flex-1 p-6 md:p-8 lg:p-10 pb-28 md:pb-12">
          <div className="max-w-[1400px] w-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav — visible only on mobile */}
      <div className="md:hidden">
        <MobileBottomNav />
      </div>
    </div>
  );
}
