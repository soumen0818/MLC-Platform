const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '../src/pages');

const sections = {
  admin: ['UsersPage', 'CommissionPage', 'WalletPage', 'WithdrawalsPage', 'RechargesPage', 'KycPage', 'ReportsPage', 'ServicesPage', 'SettingsPage'],
  'state-head': ['NetworkPage', 'FundTransferPage', 'TopupRequestPage', 'WalletPage', 'CommissionPage', 'WithdrawPage'],
  master: ['NetworkPage', 'FundTransferPage', 'TopupRequestPage', 'WalletPage', 'CommissionPage', 'WithdrawPage'],
  distributor: ['NetworkPage', 'FundTransferPage', 'TopupRequestPage', 'WalletPage', 'CommissionPage', 'WithdrawPage'],
  retailer: ['RechargePage', 'HistoryPage', 'WalletPage', 'CommissionPage', 'TopupPage', 'WithdrawPage']
};

for (const [folder, pages] of Object.entries(sections)) {
  const dirPath = path.join(baseDir, folder);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  for (const page of pages) {
    const filePath = path.join(dirPath, `${page}.tsx`);
    if (!fs.existsSync(filePath)) {
      const content = `import React from 'react';

export default function ${page}() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-[var(--color-text-primary)]">
          ${page.replace('Page', '')}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Manage your ${page.replace('Page', '').toLowerCase()} here.
        </p>
      </div>

      <div className="card p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 bg-[var(--color-bg-secondary)] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[var(--color-border)]">
             <span className="text-2xl">🚧</span>
          </div>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">Module Under Construction</h2>
          <p className="text-[var(--color-text-secondary)] max-w-md mx-auto text-sm">
            The ${page.replace('Page', '')} module is currently being finalized. Check back soon for updates.
          </p>
        </div>
      </div>
    </div>
  );
}
`;
      fs.writeFileSync(filePath, content);
      console.log(`Created ${folder}/${page}.tsx`);
    } else {
      console.log(`Skipped ${folder}/${page}.tsx (already exists)`);
    }
  }
}
