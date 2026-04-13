import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_LABELS } from '@/types';
import { getInitials } from '@/lib/utils';
import { User, Mail, Phone, Shield, Save, X } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, fetchMe } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    upiId: user?.upiId || ''
  });

  if (!user) return null;

  const handleSaveProfile = async () => {
    // Pre-flight validation
    if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
      toast.error('Phone number must be exactly 10 digits.');
      return;
    }

    try {
      setIsSavingProfile(true);
      await api.patch(`/users/${user.id}/profile`, formData);
      await fetchMe();
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (e) {
      toast.error('Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const fields = [
    { label: 'Name', value: user.name || 'Not Set', icon: <User size={16} className="text-text-secondary" /> },
    { label: 'Role', value: ROLE_LABELS[user.role], icon: <Shield size={16} className="text-text-secondary" /> },
    { label: 'UPI Address', value: user.upiId || 'Not Set', icon: <span className="text-text-secondary font-bold text-[10px]">UPI</span> },
    { label: 'Email', value: user.email, icon: <Mail size={16} className="text-text-secondary" /> },
    { label: 'Phone', value: user.phone || 'Not Provided', icon: <Phone size={16} className="text-text-secondary" /> },
  ];

  return (
    <div className="flex flex-col gap-6 font-sans pb-10">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Profile Center</h1>
        <p className="text-[14px] text-text-secondary mt-1">Manage your account identity and contact details.</p>
      </div>

      {/* Avatar Header */}
      <div className="card p-7 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-sidebar-bg flex items-center justify-center text-primary text-[18px] font-bold shrink-0">
          {getInitials(user.name)}
        </div>
        <div>
          <p className="text-[16px] font-semibold text-text-primary m-0">{user.name ? user.name : <span className="text-text-muted italic text-[14px]">Name not set</span>}</p>
          <p className="text-[13px] text-text-secondary m-0">{ROLE_LABELS[user.role]} • {user.email}</p>
        </div>
      </div>

      {/* Details Card */}
      <div className="card p-6 relative max-w-xl">
        <h3 className="text-[14px] font-semibold text-text-primary mb-4 flex items-center gap-2"><User size={16} className="text-primary"/> Personal Details</h3>

        {isEditing ? (
           <div className="flex flex-col gap-4 animate-fade-in py-2">
              <div>
                 <label className="block text-[11px] uppercase tracking-wider font-semibold text-text-secondary mb-1.5">Full Name</label>
                 <input type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full h-10 px-3 bg-background border border-border rounded-lg text-text-primary text-[14px] outline-none focus:border-primary transition-all" placeholder="Enter full name" />
              </div>
              <div>
                 <label className="block text-[11px] uppercase tracking-wider font-semibold text-text-secondary mb-1.5">Phone Number</label>
                 <input
                   type="tel"
                   value={formData.phone}
                   onChange={e=>setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})}
                   className="w-full h-10 px-3 bg-background border border-border rounded-lg text-[14px] outline-none font-mono focus:border-primary transition-all"
                   placeholder="10-digit number"
                   maxLength={10}
                   pattern="\d{10}"
                 />
              </div>
              <div>
                 <label className="block text-[11px] uppercase tracking-wider font-semibold text-text-secondary mb-1.5">UPI Address</label>
                 <input type="text" value={formData.upiId} onChange={e=>setFormData({...formData, upiId: e.target.value.toLowerCase()})} className="w-full h-10 px-3 bg-background border border-border rounded-lg text-text-primary text-[14px] outline-none focus:border-primary transition-all font-mono" placeholder="e.g. yourname@ybl" />
              </div>
              <div className="flex gap-3 mt-2">
                 <button onClick={() => setIsEditing(false)} className="flex-1 h-10 rounded-lg bg-background-secondary border border-border text-text-primary text-[13px] font-semibold hover:bg-background outline-none cursor-pointer flex justify-center items-center gap-2">
                    <X size={16}/> Cancel
                 </button>
                 <button onClick={handleSaveProfile} disabled={isSavingProfile} className="flex-1 h-10 rounded-lg bg-primary border-none text-black text-[13px] font-bold hover:bg-primary/90 outline-none cursor-pointer flex justify-center items-center gap-2 opacity-disabled">
                    {isSavingProfile ? 'Saving...' : <><Save size={16}/> Save Changes</>}
                 </button>
              </div>
           </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {fields.map((f) => (
                <div key={f.label} className="p-3.5 rounded-xl bg-background-secondary border border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shrink-0">
                      {f.icon}
                    </div>
                    <div>
                      <span className="block text-[10px] text-text-muted font-semibold uppercase tracking-[0.08em]">{f.label}</span>
                      <p className="text-[14px] font-mono font-medium text-text-primary m-0">{f.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setIsEditing(true)} className="w-full mt-4 h-10 rounded-lg border border-border bg-transparent text-text-secondary font-semibold text-[13px] hover:text-text-primary hover:bg-background transition-colors outline-none cursor-pointer">
              Edit Information
            </button>
          </>
        )}
      </div>
    </div>
  );
}
