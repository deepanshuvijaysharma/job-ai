import React from 'react';
import { LayoutDashboard, Briefcase, Mail, Kanban, UserCheck, Target, BarChart3, Sparkles, ShieldCheck } from 'lucide-react';

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<Props> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', label: "Today's Plan", icon: LayoutDashboard },
    { id: 'jobs', label: 'Job Discovery & Matches', icon: Briefcase },
    { id: 'outreach', label: 'Recruiter Outreach & Queue', icon: Mail },
    { id: 'pipeline', label: 'Application Pipeline', icon: Kanban },
    { id: 'interview', label: 'Interview Prep Coach', icon: Target },
    { id: 'profile', label: 'Candidate Profile & Resumes', icon: UserCheck },
    { id: 'analytics', label: 'Analytics & Funnel Yield', icon: BarChart3 },
  ];

  return (
    <aside className="w-64 bg-dark-800 border-r border-slate-800 flex flex-col justify-between p-4 min-h-screen">
      <div className="space-y-6">
        
        {/* Brand Header */}
        <div className="flex items-center space-x-3 px-2 py-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-base tracking-tight leading-none">JobHunter AI</h1>
            <p className="text-[10px] text-brand-400 font-semibold tracking-wider mt-1">RECRUITER OUTREACH AGENT</p>
          </div>
        </div>

        {/* Compliance Badge */}
        <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center space-x-2 text-[11px] text-emerald-400">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Terms Compliant • User Approval Enforced</span>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-brand-600/15 text-brand-400 border border-brand-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

      </div>

      {/* User Info Footer */}
      <div className="pt-4 border-t border-slate-800 flex items-center justify-between px-2">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-white">
            DS
          </div>
          <div className="text-left">
            <div className="text-xs font-bold text-white">Deepanshu S.</div>
            <div className="text-[10px] text-slate-400">Full Stack Engineer</div>
          </div>
        </div>
      </div>

    </aside>
  );
};
