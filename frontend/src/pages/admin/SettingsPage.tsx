import { Settings2, Shield } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight m-0">Platform Settings</h1>
        <p className="text-[14px] text-text-secondary mt-1">Master configuration override for the entire engine.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 border border-border">
          <h2 className="text-[16px] font-bold text-text-primary mb-4 flex items-center gap-2"><Settings2 size={18}/> General Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Platform Title</label>
              <input type="text" defaultValue="MLC Platform" className="w-full h-10 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-[14px]" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Support Email</label>
              <input type="email" defaultValue="support@mlcplatform.com" className="w-full h-10 px-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-[14px]" />
            </div>
            <button className="h-10 px-6 mt-2 rounded-lg bg-text-primary text-background font-bold text-[13px] hover:bg-black">Save Changes</button>
          </div>
        </div>

        <div className="card p-6 border border-border">
          <h2 className="text-[16px] font-bold text-text-primary mb-4 flex items-center gap-2"><Shield size={18}/> Security Controls</h2>
          <div className="space-y-5">
            <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-background/50">
              <div>
                <p className="text-[14px] font-bold text-text-primary">Maintenance Mode</p>
                <p className="text-[12px] text-text-secondary mt-0.5">Locks out all non-admin sessions instantly.</p>
              </div>
              <div className="w-10 h-5 bg-border rounded-full relative cursor-pointer"><div className="w-4 h-4 bg-white rounded-full absolute left-0.5 top-0.5" /></div>
            </div>
            <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-background/50">
              <div>
                <p className="text-[14px] font-bold text-text-primary">Strict IP Logging</p>
                <p className="text-[12px] text-text-secondary mt-0.5">Logs all API execution IP addresses.</p>
              </div>
               <div className="w-10 h-5 bg-primary rounded-full relative cursor-pointer"><div className="w-4 h-4 bg-black rounded-full absolute right-0.5 top-0.5" /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
