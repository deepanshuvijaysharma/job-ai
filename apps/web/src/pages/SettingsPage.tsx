import React, { useEffect, useState } from 'react';
import { Mail, CheckCircle2, Lock, ShieldCheck, Send, RefreshCw, Sparkles, Key, AlertCircle } from 'lucide-react';
import { apiClient } from '../services/apiClient';

export const SettingsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [testRecipient, setTestRecipient] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/email/accounts');
      setAccounts(res.data);
      if (res.data.length > 0) {
        setSelectedAccountId(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load connected email accounts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleConnectGmail = async () => {
    try {
      const res = await apiClient.get('/email/oauth/gmail/url');
      window.location.href = res.data.url;
    } catch (err) {
      alert('Failed to initialize Gmail OAuth flow');
    }
  };

  const handleConnectOutlook = async () => {
    try {
      const res = await apiClient.get('/email/oauth/outlook/url');
      window.location.href = res.data.url;
    } catch (err) {
      alert('Failed to initialize Outlook OAuth flow');
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient) return;

    try {
      setSendingTest(true);
      setTestResult(null);
      const res = await apiClient.post('/email/test', {
        accountId: selectedAccountId,
        recipientEmail: testRecipient
      });
      setTestResult(res.data.message);
      fetchAccounts();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center space-x-2">
          <Mail className="w-6 h-6 text-brand-400" />
          <span>Gmail & Outlook Integration Settings</span>
        </h1>
        <p className="text-slate-400 text-xs mt-1">Connect your real email account via OAuth 2.0 with AES-256 encrypted token security for approved outreach dispatch.</p>
      </div>

      {/* Connection Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Gmail OAuth */}
        <div className="bg-dark-800 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 font-extrabold text-lg">
              M
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Google Gmail Integration</h2>
              <p className="text-xs text-slate-400">OAuth 2.0 with minimum required send permissions</p>
            </div>
          </div>
          <p className="text-xs text-slate-300">
            Connect your Gmail account to dispatch approved recruiter outreach emails directly from your personal inbox. Passwords are never stored.
          </p>
          <button
            onClick={handleConnectGmail}
            className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-red-600/20"
          >
            <Lock className="w-4 h-4" />
            <span>Connect Gmail via OAuth 2.0</span>
          </button>
        </div>

        {/* Outlook OAuth */}
        <div className="bg-dark-800 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-extrabold text-lg">
              O
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Microsoft Outlook Integration</h2>
              <p className="text-xs text-slate-400">Microsoft Graph OAuth with Mail.Send permissions</p>
            </div>
          </div>
          <p className="text-xs text-slate-300">
            Connect your Microsoft Outlook / Office365 email account for seamless recruiter outreach and candidate response tracking.
          </p>
          <button
            onClick={handleConnectOutlook}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/20"
          >
            <Lock className="w-4 h-4" />
            <span>Connect Outlook via Microsoft OAuth</span>
          </button>
        </div>

      </div>

      {/* Connected Accounts & Safe Test Email Section */}
      <div className="bg-dark-800 border border-slate-800 p-6 rounded-2xl space-y-6">
        <h2 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Connected Accounts & AES-256 Token Encryption Status</span>
          </span>
          <span className="text-xs font-normal text-slate-400">
            AES-256-CBC Encrypted • Tokens Never Exposed to Frontend
          </span>
        </h2>

        {loading ? (
          <div className="py-6 text-center text-slate-400 text-xs">Loading connected email accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto text-amber-400" />
            <div className="font-semibold text-slate-300">No email accounts connected yet</div>
            <p>Connect your Gmail or Outlook account above to enable safe, user-approved recruiter outreach.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {accounts.map(acc => (
                <div key={acc.id} className="bg-dark-900 border border-slate-800 p-4 rounded-xl space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white uppercase flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{acc.provider} OAuth Connected</span>
                    </span>
                    {acc.isDefault && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/30">
                        DEFAULT SENDER
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-brand-300">{acc.emailAddress}</div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
                    <span>Connected {new Date(acc.createdAt).toLocaleDateString()}</span>
                    <span>Tokens: <strong className="text-emerald-400 font-mono">Encrypted 🔒</strong></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Safe Test Email Mechanism Form */}
            <form onSubmit={handleSendTestEmail} className="bg-dark-900 border border-slate-800 p-4 rounded-xl space-y-3 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <Send className="w-4 h-4 text-brand-400" />
                <span>Send Safe Verification Test Email</span>
              </h3>
              <p className="text-xs text-slate-400">
                Test your email connection by sending a safe verification email prior to launching recruiter outreach.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  required
                  placeholder="Enter recipient test email address..."
                  value={testRecipient}
                  onChange={e => setTestRecipient(e.target.value)}
                  className="flex-1 bg-dark-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
                <button
                  type="submit"
                  disabled={sendingTest}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 shrink-0"
                >
                  {sendingTest ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Test Email</span>
                    </>
                  )}
                </button>
              </div>

              {testResult && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-semibold">
                  ✓ {testResult}
                </div>
              )}
            </form>

          </div>
        )}
      </div>

    </div>
  );
};
