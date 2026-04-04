import { useAuthStore } from '@/stores/authStore';
import { ROLE_LABELS } from '@/types';
import { getInitials } from '@/lib/utils';
import { User, Mail, Phone, Shield } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuthStore();
  if (!user) return null;

  const fields = [
    { label: 'Name', value: user.name, icon: <User size={16} className="text-text-secondary" /> },
    { label: 'Role', value: ROLE_LABELS[user.role], icon: <Shield size={16} className="text-text-secondary" /> },
    { label: 'Email', value: user.email, icon: <Mail size={16} className="text-text-secondary" /> },
    { label: 'Phone', value: user.phone, icon: <Phone size={16} className="text-text-secondary" /> },
  ];

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Profile</h1>
        <p className="text-[14px] text-text-secondary mt-1">Account details and current access information.</p>
      </div>

      {/* Avatar Header */}
      <div className="card p-7 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-sidebar-bg flex items-center justify-center text-primary text-[18px] font-bold shrink-0">
          {getInitials(user.name)}
        </div>
        <div>
          <p className="text-[16px] font-semibold text-text-primary m-0">{user.name}</p>
          <p className="text-[13px] text-text-secondary m-0">{ROLE_LABELS[user.role]} • {user.email}</p>
        </div>
      </div>

      {/* Details */}
      <div className="card p-6">
        <h3 className="text-[14px] font-semibold text-text-primary mb-4">Account Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.label} className="p-4 rounded-xl bg-background-secondary">
              <div className="flex items-center gap-1.5 mb-1.5">
                {f.icon}
                <span className="text-[10px] text-text-muted font-semibold uppercase tracking-[0.08em]">{f.label}</span>
              </div>
              <p className="text-[14px] font-semibold text-text-primary m-0">{f.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
