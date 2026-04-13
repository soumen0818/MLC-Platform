import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { getAuthRedirectPath } from '@/lib/authRedirect';

// Layouts
import DashboardLayout from '@/components/layout/DashboardLayout';
import RoleGuard from '@/components/layout/RoleGuard';

// Auth Pages
import LoginPage from '@/pages/auth/LoginPage';
import ChangePasswordPage from '@/pages/auth/ChangePasswordPage';
import AccountPendingPage from '@/pages/auth/AccountPendingPage';

// Shared Pages
import ProfilePage from '@/pages/ProfilePage';
import GenericDashboard from '@/pages/GenericDashboard';

// Admin Dashboards
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminUsersPage from '@/pages/admin/UsersPage';
import AdminCommissionPage from '@/pages/admin/CommissionPage';
import AdminWalletPage from '@/pages/admin/WalletPage';
import AdminWithdrawalsPage from '@/pages/admin/WithdrawalsPage';
import AdminRechargesPage from '@/pages/admin/RechargesPage';
import AdminReportsPage from '@/pages/admin/ReportsPage';
import AdminServicesPage from '@/pages/admin/ServicesPage';
import AdminSettingsPage from '@/pages/admin/SettingsPage';

// State Head Pages
import StateHeadNetworkPage from '@/pages/state-head/NetworkPage';
import StateHeadFundTransferPage from '@/pages/state-head/FundTransferPage';
import StateHeadTopupRequestPage from '@/pages/state-head/TopupRequestPage';
import StateHeadWalletPage from '@/pages/state-head/WalletPage';
import StateHeadCommissionPage from '@/pages/state-head/CommissionPage';
import StateHeadWithdrawPage from '@/pages/state-head/WithdrawPage';

// Master Pages
import MasterNetworkPage from '@/pages/master/NetworkPage';
import MasterFundTransferPage from '@/pages/master/FundTransferPage';
import MasterTopupRequestPage from '@/pages/master/TopupRequestPage';
import MasterWalletPage from '@/pages/master/WalletPage';
import MasterCommissionPage from '@/pages/master/CommissionPage';
import MasterWithdrawPage from '@/pages/master/WithdrawPage';

// Distributor Pages
import DistNetworkPage from '@/pages/distributor/NetworkPage';
import DistFundTransferPage from '@/pages/distributor/FundTransferPage';
import DistTopupRequestPage from '@/pages/distributor/TopupRequestPage';
import DistWalletPage from '@/pages/distributor/WalletPage';
import DistCommissionPage from '@/pages/distributor/CommissionPage';
import DistWithdrawPage from '@/pages/distributor/WithdrawPage';

// Retailer Pages
import RetailerDashboard from '@/pages/retailer/RetailerDashboard';
import RetailerRechargePage from '@/pages/retailer/RechargePage';
import RetailerHistoryPage from '@/pages/retailer/HistoryPage';
import RetailerWalletPage from '@/pages/retailer/WalletPage';
import RetailerCommissionPage from '@/pages/retailer/CommissionPage';
import RetailerTopupPage from '@/pages/retailer/TopupPage';
import RetailerWithdrawPage from '@/pages/retailer/WithdrawPage';

import './index.css';

function App() {
  const { isAuthenticated, user, fetchMe } = useAuthStore();
  const redirectPath = getAuthRedirectPath(user);

  useEffect(() => {
    if (isAuthenticated) {
      // Forcefully sync the local user state with the absolute truth of the database on every hard refresh
      fetchMe();
    }
  }, [isAuthenticated, fetchMe]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#0A0A0A',
            color: '#fff',
            borderRadius: '12px',
            fontSize: '14px',
            fontFamily: "'Inter', sans-serif",
            border: '1px solid #27272a'
          },
          success: {
            iconTheme: { primary: '#ccff00', secondary: '#0A0A0A' },
          },
          error: {
            iconTheme: { primary: '#EF4444', secondary: '#fff' },
          },
        }}
      />

      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            isAuthenticated && user ? (
              <Navigate to={redirectPath} replace />
            ) : (
              <LoginPage />
            )
          }
        />

        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/account-pending" element={<AccountPendingPage />} />

        {/* Admin Routes */}
        <Route
          element={
            <RoleGuard allowedRoles={['SUPER_ADMIN']}>
              <DashboardLayout />
            </RoleGuard>
          }
        >
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/commission" element={<AdminCommissionPage />} />
          <Route path="/admin/wallet" element={<AdminWalletPage />} />
          <Route path="/admin/withdrawals" element={<AdminWithdrawalsPage />} />
          <Route path="/admin/recharges" element={<AdminRechargesPage />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />
          <Route path="/admin/services" element={<AdminServicesPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
        </Route>

        {/* State Head Routes */}
        <Route
          element={
            <RoleGuard allowedRoles={['STATE_HEAD']}>
              <DashboardLayout />
            </RoleGuard>
          }
        >
          <Route path="/state-head/dashboard" element={<GenericDashboard />} />
          <Route path="/state-head/network" element={<StateHeadNetworkPage />} />
          <Route path="/state-head/fund-transfer" element={<StateHeadFundTransferPage />} />
          <Route path="/state-head/topup-request" element={<StateHeadTopupRequestPage />} />
          <Route path="/state-head/wallet" element={<StateHeadWalletPage />} />
          <Route path="/state-head/commission" element={<StateHeadCommissionPage />} />
          <Route path="/state-head/withdraw" element={<StateHeadWithdrawPage />} />
        </Route>

        {/* Master Distributor Routes */}
        <Route
          element={
            <RoleGuard allowedRoles={['MASTER_DISTRIBUTOR']}>
              <DashboardLayout />
            </RoleGuard>
          }
        >
          <Route path="/master/dashboard" element={<GenericDashboard />} />
          <Route path="/master/network" element={<MasterNetworkPage />} />
          <Route path="/master/fund-transfer" element={<MasterFundTransferPage />} />
          <Route path="/master/topup-request" element={<MasterTopupRequestPage />} />
          <Route path="/master/wallet" element={<MasterWalletPage />} />
          <Route path="/master/commission" element={<MasterCommissionPage />} />
          <Route path="/master/withdraw" element={<MasterWithdrawPage />} />
        </Route>

        {/* Distributor Routes */}
        <Route
          element={
            <RoleGuard allowedRoles={['DISTRIBUTOR']}>
              <DashboardLayout />
            </RoleGuard>
          }
        >
          <Route path="/distributor/dashboard" element={<GenericDashboard />} />
          <Route path="/distributor/network" element={<DistNetworkPage />} />
          <Route path="/distributor/fund-transfer" element={<DistFundTransferPage />} />
          <Route path="/distributor/topup-request" element={<DistTopupRequestPage />} />
          <Route path="/distributor/wallet" element={<DistWalletPage />} />
          <Route path="/distributor/commission" element={<DistCommissionPage />} />
          <Route path="/distributor/withdraw" element={<DistWithdrawPage />} />
        </Route>

        {/* Retailer Routes */}
        <Route
          element={
            <RoleGuard allowedRoles={['RETAILER']}>
              <DashboardLayout />
            </RoleGuard>
          }
        >
          <Route path="/retailer/dashboard" element={<RetailerDashboard />} />
          <Route path="/retailer/recharge" element={<RetailerRechargePage />} />
          <Route path="/retailer/history" element={<RetailerHistoryPage />} />
          <Route path="/retailer/wallet" element={<RetailerWalletPage />} />
          <Route path="/retailer/commission" element={<RetailerCommissionPage />} />
          <Route path="/retailer/topup" element={<RetailerTopupPage />} />
          <Route path="/retailer/withdraw" element={<RetailerWithdrawPage />} />
        </Route>

        {/* Default Redirect */}
        <Route
          path="/profile"
          element={
            <RoleGuard allowedRoles={['SUPER_ADMIN', 'STATE_HEAD', 'MASTER_DISTRIBUTOR', 'DISTRIBUTOR', 'RETAILER']}>
              <DashboardLayout />
            </RoleGuard>
          }
        >
          <Route index element={<ProfilePage />} />
        </Route>

        <Route path="/" element={<Navigate to={isAuthenticated && user ? redirectPath : '/login'} replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
