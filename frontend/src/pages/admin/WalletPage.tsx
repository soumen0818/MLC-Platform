import { Construction } from 'lucide-react';

export default function WalletPage() {
  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Wallet Management</h1>
        <p className="text-[14px] text-text-secondary mt-1">Monitor and manage wallet balances across the network.</p>
      </div>
      <div className="card p-10 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-background border border-border flex items-center justify-center mx-auto mb-4">
            <Construction size={24} className="text-text-muted" />
          </div>
          <h2 className="text-[16px] font-bold text-text-primary mb-2">Module Under Construction</h2>
          <p className="text-[13px] text-text-secondary max-w-[360px] mx-auto leading-relaxed">
            The Wallet Management module is currently being finalized. Check back soon for updates.
          </p>
        </div>
      </div>
    </div>
  );
}
