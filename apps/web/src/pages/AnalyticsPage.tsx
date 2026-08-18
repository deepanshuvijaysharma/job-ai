import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Target, Briefcase, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../services/apiClient';

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await apiClient.get('/analytics/dashboard');
        setData(res.data);
      } catch (err) {
        console.error('Failed to load analytics', err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  if (loading) {
    return <div className="p-8 text-slate-400">Loading conversion yield analytics...</div>;
  }

  const funnel = data?.funnel;
  const metrics = data?.metrics;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center space-x-2">
          <BarChart3 className="w-6 h-6 text-brand-400" />
          <span>Job Search Conversion Analytics & Funnel Yield</span>
        </h1>
        <p className="text-slate-400 text-xs mt-1">Empirical data measuring which job-search activities and roles actually produce interviews.</p>
      </div>

      {/* Top Metric Conversion Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-dark-800 border border-slate-800 p-5 rounded-2xl space-y-2">
          <div className="text-xs font-semibold text-slate-400">Application → Response Rate</div>
          <div className="text-3xl font-extrabold text-emerald-400">{metrics?.appToResponseRate}%</div>
          <p className="text-[11px] text-slate-400">Recruiter replies per application</p>
        </div>

        <div className="bg-dark-800 border border-slate-800 p-5 rounded-2xl space-y-2">
          <div className="text-xs font-semibold text-slate-400">Application → Interview Rate</div>
          <div className="text-3xl font-extrabold text-brand-400">{metrics?.appToInterviewRate}%</div>
          <p className="text-[11px] text-slate-400">Scheduled interviews per app</p>
        </div>

        <div className="bg-dark-800 border border-slate-800 p-5 rounded-2xl space-y-2">
          <div className="text-xs font-semibold text-slate-400">Recruiter Outreach Response</div>
          <div className="text-3xl font-extrabold text-purple-400">{metrics?.outreachToResponseRate}%</div>
          <p className="text-[11px] text-slate-400">Direct outreach reply rate</p>
        </div>

        <div className="bg-dark-800 border border-slate-800 p-5 rounded-2xl space-y-2">
          <div className="text-xs font-semibold text-slate-400">Total Interviews Scheduled</div>
          <div className="text-3xl font-extrabold text-white">{funnel?.interviews || 0}</div>
          <p className="text-[11px] text-emerald-400 font-semibold">{funnel?.offers || 0} Offers Received 🎉</p>
        </div>

      </div>

      {/* Conversion Funnel Breakdown */}
      <div className="bg-dark-800 border border-slate-800 p-6 rounded-2xl space-y-4">
        <h2 className="text-base font-bold text-white flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-brand-400" />
          <span>Full Conversion Funnel Diagnostic</span>
        </h2>

        {funnel?.jobsDiscovered === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300">No application metric history recorded yet</div>
            <p>Import jobs and submit applications to start tracking dynamic conversion yield.</p>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {[
              { label: 'Jobs Discovered', count: funnel?.jobsDiscovered || 0, pct: 100, color: 'bg-slate-700' },
              { label: 'Relevant Opportunities (>=65% Match)', count: funnel?.relevantJobs || 0, pct: funnel?.jobsDiscovered ? Math.round((funnel.relevantJobs / funnel.jobsDiscovered) * 100) : 0, color: 'bg-slate-600' },
              { label: 'High Priority (90-100% Match)', count: funnel?.highPriorityJobs || 0, pct: funnel?.jobsDiscovered ? Math.round((funnel.highPriorityJobs / funnel.jobsDiscovered) * 100) : 0, color: 'bg-brand-600' },
              { label: 'Applications Submitted', count: funnel?.applications || 0, pct: funnel?.jobsDiscovered ? Math.round((funnel.applications / funnel.jobsDiscovered) * 100) : 0, color: 'bg-brand-500' },
              { label: 'Recruiter Conversations', count: funnel?.recruiterConversations || 0, pct: funnel?.applications ? Math.round((funnel.recruiterConversations / funnel.applications) * 100) : 0, color: 'bg-amber-500' },
              { label: 'Interviews Scheduled', count: funnel?.interviews || 0, pct: funnel?.applications ? Math.round((funnel.interviews / funnel.applications) * 100) : 0, color: 'bg-purple-500' },
              { label: 'Offers Received', count: funnel?.offers || 0, pct: funnel?.applications ? Math.round((funnel.offers / funnel.applications) * 100) : 0, color: 'bg-emerald-500' },
            ].map((stage, i) => (
              <div key={i} className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-300 font-medium">
                  <span>{stage.label}</span>
                  <span className="font-bold text-white">{stage.count} ({stage.pct}%)</span>
                </div>
                <div className="w-full bg-dark-900 h-3 rounded-full overflow-hidden border border-slate-800">
                  <div className={`${stage.color} h-full rounded-full transition-all duration-500`} style={{ width: `${Math.max(stage.count > 0 ? 3 : 0, stage.pct)}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Yield by Role & Source */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Yield by Role */}
        <div className="bg-dark-800 border border-slate-800 p-5 rounded-2xl space-y-3">
          <h3 className="text-sm font-bold text-white">Conversion Yield by Target Role</h3>
          <div className="space-y-2 text-xs">
            {data?.yieldByRole?.length === 0 ? (
              <div className="py-6 text-center text-slate-500">No application yield recorded by role yet</div>
            ) : (
              data?.yieldByRole?.map((r: any, i: number) => (
                <div key={i} className="bg-dark-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">{r.role}</div>
                    <div className="text-[11px] text-slate-400">{r.applications} Applications • {r.responses} Responses</div>
                  </div>
                  <div className="text-right font-extrabold text-emerald-400 text-sm">
                    {r.rate}%
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Yield by Source */}
        <div className="bg-dark-800 border border-slate-800 p-5 rounded-2xl space-y-3">
          <h3 className="text-sm font-bold text-white">Conversion Yield by Job Source</h3>
          <div className="space-y-2 text-xs">
            {data?.yieldBySource?.length === 0 ? (
              <div className="py-6 text-center text-slate-500">No application yield recorded by source yet</div>
            ) : (
              data?.yieldBySource?.map((s: any, i: number) => (
                <div key={i} className="bg-dark-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">{s.source}</div>
                    <div className="text-[11px] text-slate-400">{s.applications} Applications • {s.interviews} Interviews</div>
                  </div>
                  <div className="text-right font-extrabold text-brand-400 text-sm">
                    {s.rate}%
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
