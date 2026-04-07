import { useState, useEffect } from 'react';
import { Search, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import api from '@/lib/api';

interface KycDocument {
  id: string;
  userId: string;
  docType: string;
  fileUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export default function KycPage() {
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [processingAction, setProcessingAction] = useState<{ id: string, type: 'APPROVED' | 'REJECTED' } | null>(null);

  const fetchPending = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get('/kyc/pending');
      setDocuments(data.documents || []);
    } catch {
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleReview = async (docId: string, action: 'APPROVED' | 'REJECTED') => {
    const reason = action === 'REJECTED' ? window.prompt('Enter rejection reason:') : undefined;
    if (action === 'REJECTED' && !reason) return; // cancelled

    setProcessingAction({ id: docId, type: action });
    try {
      await api.patch(`/kyc/${docId}/review`, {
        action,
        rejectionReason: reason
      });
      // Remove from list
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (err) {
      alert('Failed to process document');
    } finally {
      setProcessingAction(null);
    }
  };

  const filteredDocs = documents.filter(doc => 
    doc.userId.toLowerCase().includes(search.toLowerCase()) || 
    doc.docType.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">KYC Review Queue</h1>
          <p className="text-[14px] text-text-secondary mt-1">
            {documents.length} pending document{documents.length === 1 ? '' : 's'} require your attention.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input 
            type="text" 
            placeholder="Search by ID or Type..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-[280px] h-10 pl-10 pr-4 rounded-xl border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-text-muted text-[14px]"
          />
        </div>
      </div>

      <div className="card overflow-hidden border border-border bg-card shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase tracking-wider">User ID</th>
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase tracking-wider">Document Type</th>
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase tracking-wider">Submitted</th>
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase tracking-wider">File</th>
                <th className="py-4 px-5 text-[12px] font-semibold text-text-secondary uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-[13px]">Loading documents...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-text-muted">
                    <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500 opacity-50" />
                    <p className="text-[14px] font-medium text-text-primary">All caught up!</p>
                    <p className="text-[13px]">There are no pending KYC documents to review.</p>
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-table-hover transition-colors">
                    <td className="py-4 px-5">
                      <span className="text-[13px] font-medium font-mono text-text-secondary bg-background px-2 py-1 rounded border border-border">
                        {doc.userId.substring(0, 8)}...
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {doc.docType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2 text-text-secondary">
                        <Clock size={14} />
                        <span className="text-[13px]">{new Date(doc.createdAt).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <a 
                        href={doc.fileUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline group"
                      >
                        View Document
                        <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleReview(doc.id, 'APPROVED')}
                          disabled={processingAction?.id === doc.id}
                          className="w-[80px] h-8 bg-green-50 text-green-700 border border-green-200 rounded-lg text-[12px] font-semibold hover:bg-green-100 transition-colors disabled:opacity-50"
                        >
                          {processingAction?.id === doc.id && processingAction.type === 'APPROVED' ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReview(doc.id, 'REJECTED')}
                          disabled={processingAction?.id === doc.id}
                          className="w-[80px] h-8 bg-red-50 text-red-700 border border-red-200 rounded-lg text-[12px] font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          {processingAction?.id === doc.id && processingAction.type === 'REJECTED' ? '...' : 'Reject'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
