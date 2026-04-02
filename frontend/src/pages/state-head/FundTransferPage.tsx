import React from 'react';

export default function FundTransferPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-[var(--color-text-primary)]">
          FundTransfer
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Manage your fundtransfer here.
        </p>
      </div>

      <div className="card p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 bg-[var(--color-bg-secondary)] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[var(--color-border)]">
             <span className="text-2xl">🚧</span>
          </div>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">Module Under Construction</h2>
          <p className="text-[var(--color-text-secondary)] max-w-md mx-auto text-sm">
            The FundTransfer module is currently being finalized. Check back soon for updates.
          </p>
        </div>
      </div>
    </div>
  );
}
