import { useState, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { getAuthRedirectPath } from '@/lib/authRedirect';
import { FileCheck, LogOut, Upload, Loader2, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

const REQUIRED_DOCS = [
  { id: 'AADHAAR_FRONT', label: 'Aadhaar Card (Front)' },
  { id: 'AADHAAR_BACK', label: 'Aadhaar Card (Back)' },
  { id: 'PAN', label: 'PAN Card' },
  { id: 'SELFIE', label: 'Live Selfie' }
];

export default function KycPendingPage() {
  const { user, isAuthenticated, logout, fetchMe } = useAuthStore();
  
  const [uploads, setUploads] = useState<Record<string, File>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDocType, setActiveDocType] = useState<string | null>(null);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.kycStatus === 'APPROVED') {
    return <Navigate to={getAuthRedirectPath(user)} replace />;
  }

  const handleFileClick = (docType: string) => {
    setActiveDocType(docType);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && activeDocType) {
      setUploads(prev => ({ ...prev, [activeDocType]: e.target.files![0] }));
    }
  };

  const handleSubmitAll = async () => {
    const missing = REQUIRED_DOCS.filter(d => !uploads[d.id]);
    if (missing.length > 0) {
      setError(`Please upload all required documents (${missing.length} remaining)`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Upload each document sequentially (mocked with fake URL for demo purposes)
      for (const doc of REQUIRED_DOCS) {
        const fakeFileUrl = `https://s3.mlc-platform.com/uploads/${user.id}/${doc.id}_${Date.now()}.jpg`;
        await api.post('/kyc/upload', {
          docType: doc.id,
          fileUrl: fakeFileUrl
        });
      }
      
      // Refresh user to set status to SUBMITTED
      await fetchMe();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit documents. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user.kycStatus === 'SUBMITTED') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="w-full max-w-[440px] bg-card rounded-[24px] border border-border shadow-[0_4px_24px_rgba(0,0,0,0.06)] px-9 py-10 text-center">
          <div className="mx-auto mb-5 flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100">
            <FileCheck size={28} className="text-blue-500" />
          </div>
          <h1 className="text-[20px] font-bold text-text-primary mb-2">
            KYC Verification Pending
          </h1>
          <p className="text-[14px] text-text-secondary leading-relaxed mb-6">
            Your documents are currently under review. This usually takes 24-48 hours. We will notify you once verified.
          </p>
          <button
            onClick={logout}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl border border-border bg-white text-text-primary text-[14px] font-semibold cursor-pointer outline-none transition-colors hover:bg-background mx-auto"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // PENDING or REJECTED State
  return (
    <div className="min-h-screen py-12 flex flex-col items-center justify-center px-4 bg-background">
      <div className="w-full max-w-[500px] bg-card rounded-[24px] border border-border shadow-[0_4px_24px_rgba(0,0,0,0.06)] px-8 py-10">
        
        <div className="mb-8 text-center">
          <h1 className="text-[22px] font-bold text-text-primary mb-2">
            Complete Your KYC
          </h1>
          <p className="text-[14px] text-text-secondary leading-relaxed">
            {user.kycStatus === 'REJECTED' 
              ? 'Your previous submission was rejected. Please upload valid documents to continue.' 
              : 'Please upload clear photos of the following documents to activate your account.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex gap-3 text-red-600">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-[13px] font-medium mt-0.5">{error}</p>
          </div>
        )}

        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          hidden 
          accept="image/jpeg, image/png, application/pdf"
          onChange={handleFileChange} 
        />

        <div className="space-y-4 mb-8">
          {REQUIRED_DOCS.map(doc => {
            const hasUploaded = !!uploads[doc.id];
            return (
              <div 
                key={doc.id}
                onClick={() => handleFileClick(doc.id)}
                className={`flex items-center justify-between p-4 rounded-xl border ${hasUploaded ? 'border-primary bg-primary/5' : 'border-border hover:border-text-muted bg-background'} transition-colors cursor-pointer group`}
              >
                <div className="flex flex-col">
                  <span className="text-[14px] font-semibold text-text-primary">{doc.label}</span>
                  <span className="text-[12px] text-text-secondary mt-0.5">
                    {hasUploaded ? uploads[doc.id].name : 'Click to select file'}
                  </span>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${hasUploaded ? 'bg-primary text-white' : 'bg-background border border-border group-hover:bg-table-hover text-text-muted'}`}>
                  {hasUploaded ? <FileCheck size={18} /> : <Upload size={18} />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={logout}
            disabled={isSubmitting}
            className="flex-1 py-3 px-4 rounded-xl border border-border text-text-primary text-[14px] font-semibold hover:bg-background transition-colors disabled:opacity-50"
          >
            Sign Out
          </button>
          
          <button
            onClick={handleSubmitAll}
            disabled={isSubmitting}
            className="flex-[2] flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary text-white text-[14px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Documents'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
