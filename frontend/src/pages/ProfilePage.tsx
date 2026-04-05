import { useState, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_LABELS } from '@/types';
import { getInitials } from '@/lib/utils';
import { User, Mail, Phone, Shield, FileCheck, UploadCloud, AlertCircle, CheckCircle2, Save, X } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, fetchMe } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form forms
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || ''
  });

  const [docType, setDocType] = useState('AADHAAR_FRONT');

  if (!user) return null;

  const handleSaveProfile = async () => {
    // Pre-flight validation
    if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
      toast.error('Phone number must be exactly 10 digits.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.patch(`/users/${user.id}/profile`, formData);
      await fetchMe(); 
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (e) {
      toast.error('Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size < 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setIsSubmitting(true);
      
      const payload = new FormData();
      payload.append('docType', docType);
      payload.append('document', file);

      await api.post('/kyc/upload', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      await fetchMe(); 
      toast.success(`${file.name} successfully transmitted to secure server.`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to upload document');
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fields = [
    { label: 'Name', value: user.name || 'Not Set', icon: <User size={16} className="text-text-secondary" /> },
    { label: 'Role', value: ROLE_LABELS[user.role], icon: <Shield size={16} className="text-text-secondary" /> },
    { label: 'Email', value: user.email, icon: <Mail size={16} className="text-text-secondary" /> },
    { label: 'Phone', value: user.phone || 'Not Provided', icon: <Phone size={16} className="text-text-secondary" /> },
  ];

  return (
    <div className="flex flex-col gap-6 font-sans pb-10">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Profile Center</h1>
        <p className="text-[14px] text-text-secondary mt-1">Manage your identity and KYC documents.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Details */}
        <div className="card p-6 relative">
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
                <div className="flex gap-3 mt-2">
                   <button onClick={() => setIsEditing(false)} className="flex-1 h-10 rounded-lg bg-background-secondary border border-border text-text-primary text-[13px] font-semibold hover:bg-background outline-none cursor-pointer flex justify-center items-center gap-2">
                      <X size={16}/> Cancel
                   </button>
                   <button onClick={handleSaveProfile} disabled={isSubmitting} className="flex-1 h-10 rounded-lg bg-primary border-none text-black text-[13px] font-bold hover:bg-primary/90 outline-none cursor-pointer flex justify-center items-center gap-2 opacity-disabled">
                      {isSubmitting ? 'Saving...' : <><Save size={16}/> Save Changes</>}
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

        {/* KYC Section */}
        {user.role !== 'SUPER_ADMIN' && (
          <div className="card p-6 border-l-[4px] border-l-primary flex flex-col">
            <h3 className="text-[14px] font-semibold text-text-primary mb-4 flex items-center gap-2"><FileCheck size={16} className="text-primary"/> KYC Status Tracker</h3>
            
            <div className="flex-1 flex flex-col justify-center items-center text-center p-6 border border-dashed border-border rounded-xl bg-background-secondary/50">
               {user.kycStatus === 'APPROVED' ? (
                 <>
                   <CheckCircle2 size={40} className="text-emerald-500 mb-3" />
                   <p className="text-[16px] font-bold text-text-primary">Fully Verified</p>
                   <p className="text-[13px] text-text-secondary mt-1">Your identity documents have been approved by the Admin node.</p>
                 </>
               ) : user.kycStatus === 'SUBMITTED' ? (
                 <>
                   <FileCheck size={40} className="text-blue-500 mb-3" />
                   <p className="text-[16px] font-bold text-text-primary">Under Review</p>
                   <p className="text-[13px] text-text-secondary mt-1">Your documents have been securely transmitted. Awaiting Super Admin review protocol.</p>
                 </>
               ) : (
                 <>
                   <AlertCircle size={40} className="text-amber-500 mb-2" />
                   <p className="text-[16px] font-bold text-text-primary">Verification Pending</p>
                   <p className="text-[13px] text-text-secondary mt-1 mb-5">Please upload your government IDs and business proofs to unlock your dashboard functionalities.</p>
                   
                   <div className="w-full max-w-[250px] mb-4">
                     <label className="block text-[11px] uppercase text-left tracking-wider font-semibold text-text-secondary mb-1.5">Document Type</label>
                     <select value={docType} onChange={e=>setDocType(e.target.value)} disabled={isSubmitting} className="w-full h-10 px-3 border border-border rounded-lg bg-background text-[13px] font-medium outline-none focus:border-primary">
                        <option value="AADHAAR_FRONT">Aadhaar (Front)</option>
                        <option value="AADHAAR_BACK">Aadhaar (Back)</option>
                        <option value="PAN">PAN Card</option>
                        <option value="GST">GST Certificate</option>
                        <option value="CANCELLED_CHEQUE">Cancelled Cheque</option>
                     </select>
                   </div>

                   <input 
                     type="file" 
                     className="hidden" 
                     ref={fileInputRef} 
                     onChange={handleFileChange} 
                     accept="image/jpeg, image/png, image/webp, application/pdf"
                   />
                   <button 
                     disabled={isSubmitting}
                     className="px-6 h-10 rounded-lg bg-primary text-black font-bold text-[13px] border-none outline-none cursor-pointer flex items-center gap-2 shadow-[0_0_15px_rgba(204,255,0,0.15)] hover:bg-primary/90 transition-all opacity-disabled w-full max-w-[250px] justify-center"
                     onClick={() => fileInputRef.current?.click()}
                   >
                     {isSubmitting ? 'Uploading securely...' : <><UploadCloud size={16} /> Select Required Documents</>}
                   </button>
                 </>
               )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
