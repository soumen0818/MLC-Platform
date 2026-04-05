import { Download, FileText, Filter } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Analytics & Reports</h1>
        <p className="text-[14px] text-text-secondary mt-1">Export transaction histories and audit logs.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6 border border-border">
          <h2 className="text-[16px] font-bold text-text-primary mb-4 flex items-center gap-2"><FileText size={18} /> Daily Transaction Report</h2>
          <p className="text-[13px] text-text-secondary mb-4">Export a complete CSV of all network transactions for reconciliation.</p>
          <div className="flex gap-4 mb-4">
            <input type="date" className="h-10 px-3 bg-background border border-border text-[13px] rounded-lg outline-none focus:border-primary flex-1 text-text-primary" />
            <button className="h-10 px-6 rounded-lg bg-primary text-black font-bold text-[13px] flex items-center gap-2 hover:bg-primary/90">
              <Download size={16} /> Export CSV
            </button>
          </div>
        </div>
        
        <div className="card p-6 border border-border">
          <h2 className="text-[16px] font-bold text-text-primary mb-4 flex items-center gap-2"><Filter size={18} /> Commission Audit</h2>
          <p className="text-[13px] text-text-secondary mb-4">Download comprehensive commission distributions grouped by tiers.</p>
          <div className="flex gap-4 mb-4">
            <select className="h-10 px-3 bg-background border border-border text-[13px] rounded-lg outline-none focus:border-primary flex-1 font-medium text-text-primary">
              <option>This Week</option>
              <option>This Month</option>
              <option>Last 30 Days</option>
            </select>
            <button className="h-10 px-6 rounded-lg bg-text-primary text-background font-bold text-[13px] flex items-center gap-2 hover:bg-black">
              <Download size={16} /> Extract Log
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
