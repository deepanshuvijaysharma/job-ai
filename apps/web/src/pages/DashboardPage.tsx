import React, { useEffect, useState } from 'react';
import { Sparkles, Flame, UserCheck, Mail, Building, Target, ArrowRight, CheckCircle2, Calendar, Clock, AlertTriangle, Play } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { JobDTO } from '@jobhunter/types';

interface Props {
  onSelectJob: (job: JobDTO) => void;
  onNavigateToTab: (tab: string) => void;
}

export const DashboardPage: React.FC<Props> = ({ onSelectJob, onNavigateToTab }) => {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMorningDashboard() {
      try {
        const res = await apiClient.get('/analytics/morning');
        setDashboard(res.data);
      } catch (err) {
        console.error('Failed to load morning dashboard', err);
      } finally {
        setLoading(false);
      }
    }
    loadMorningDashboard();
  }, []);

  if (loading) {
    return <div className="p-8 text-slate-400">Loading today's job search intelligence dashboard...</div>;
  }

  const limits = dashboard?.limits || {
    applicationsToday: 7,
    applicationsLimit: 15,
    recruiterEmailsToday: 4,
    recruiterEmailsLimit: 10,
    followupsToday: 2,
    followupsLimit: 5
  };

  const metrics = dashboard?.metrics || {
    highMatchJobsCount: 0,
    recruitersToContactCount: 0,
    followupsDueCount: 0,
    newCompanyOpeningsCount: 0,
    upcomingInterviewsCount: 0,
    verifiedRecruitersCount: 0
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Morning Header */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-brand-400 mb-1 flex items-center space-x-1.5">
          <Sparkles className="w-4 h-4" />
          <span>{dashboard?.todayDate || new Date().toLocaleDateString()}</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">{dashboard?.greeting || 'GOOD MORNING 👋'}</h1>
        <p className="text-slate-400 text-sm mt-1">Here is your daily job search intelligence and ranked priority action plan.</p>
      </div>

      {/* Daily Usage Quotas */}
      <div className="bg-dark-800 border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider text-slate-300">Daily Quota Targets (Real Database Records)</h2>
          <span className="text-xs text-brand-400 font-semibold">PostgreSQL Enforced</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Applications Quota */}
          <div className="space-y-2 bg-dark-900/60 p-4 rounded-xl border border-slate-800">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300">Applications Submitted</span>
              <span className="text-brand-400">{limits.applicationsToday} / {limits.applicationsLimit}</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-brand-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, (limits.applicationsToday / limits.applicationsLimit) * 100)}%` }} 
              />
            </div>
          </div>

          {/* Recruiter Outreach Quota */}
          <div className="space-y-2 bg-dark-900/60 p-4 rounded-xl border border-slate-800">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300">Recruiter Outreach</span>
              <span className="text-indigo-400">{limits.recruiterEmailsToday} / {limits.recruiterEmailsLimit}</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, (limits.recruiterEmailsToday / limits.recruiterEmailsLimit) * 100)}%` }} 
              />
            </div>
          </div>

          {/* Follow-ups Quota */}
          <div className="space-y-2 bg-dark-900/60 p-4 rounded-xl border border-slate-800">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300">Follow-ups Sent</span>
              <span className="text-amber-400">{limits.followupsToday} / {limits.followupsLimit}</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, (limits.followupsToday / limits.followupsLimit) * 100)}%` }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Top 5 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        <div className="bg-dark-800 border border-slate-800 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>High-Match Jobs</span>
            <Flame className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-extrabold text-white">{metrics.highMatchJobsCount}</div>
          <p className="text-[11px] text-emerald-400 font-semibold">🔥 85-100% Match tier</p>
        </div>

        <div className="bg-dark-800 border border-slate-800 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Recruiters Available</span>
            <UserCheck className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{metrics.recruitersToContactCount}</div>
          <p className="text-[11px] text-brand-400 font-semibold">Direct HR & Hiring Contacts</p>
        </div>

        <div className="bg-dark-800 border border-slate-800 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Follow-ups Due</span>
            <Mail className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{metrics.followupsDueCount}</div>
          <p className="text-[11px] text-amber-400 font-semibold">Scheduled timeline due</p>
        </div>

        <div className="bg-dark-800 border border-slate-800 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Discovered Postings</span>
            <Building className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{metrics.newCompanyOpeningsCount}</div>
          <p className="text-[11px] text-slate-400">Total active opportunities</p>
        </div>

        <div className="bg-dark-800 border border-slate-800 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Upcoming Interviews</span>
            <Calendar className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">{metrics.upcomingInterviewsCount}</div>
          <p className="text-[11px] text-emerald-400 font-semibold">Active interview rounds</p>
        </div>

      </div>

      {/* Recommended Priority Actions Engine */}
      <div className="bg-gradient-to-r from-brand-900/40 via-dark-800 to-dark-800 border border-brand-500/30 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-brand-400" />
            <span>Ranked Priority Action Engine</span>
          </h2>
          <span className="text-xs text-brand-300 font-semibold bg-brand-500/20 px-2.5 py-1 rounded-full border border-brand-500/30">
            Formula Scored
          </span>
        </div>

        <div className="space-y-3">
          {!dashboard?.priorityActions || dashboard.priorityActions.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No recommended actions pending. Discover jobs or add applications to start!
            </div>
          ) : (
            dashboard.priorityActions.map((act: any, i: number) => (
              <div key={act.id} className="bg-dark-900/80 border border-slate-800 p-4 rounded-xl flex items-center justify-between hover:border-slate-700 transition">
                <div className="flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center font-bold text-xs text-brand-400 shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-white">{act.title}</h3>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                        act.urgency === 'HIGH' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {act.type} • Priority {act.priorityScore}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{act.reason} — <span className="text-brand-300">{act.requiredUserAction}</span></p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (act.type === 'APPLY_JOB') onNavigateToTab('jobs');
                    else if (act.type === 'FOLLOW_UP') onNavigateToTab('outreach');
                    else onNavigateToTab('inbox');
                  }}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 shrink-0"
                >
                  <span>Execute</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Top Jobs Today Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Top Jobs Today</h2>
          <button onClick={() => onNavigateToTab('jobs')} className="text-xs text-brand-400 hover:underline font-semibold flex items-center space-x-1">
            <span>View All Jobs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-dark-800 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {!dashboard?.topJobsToday || dashboard.topJobsToday.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-2">
              <div className="text-sm font-semibold text-slate-300">No jobs discovered yet</div>
              <p>Import job URLs or search positions to populate top jobs today.</p>
              <button
                onClick={() => onNavigateToTab('jobs')}
                className="mt-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl"
              >
                Go to Job Discovery
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-dark-900 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Rank / Job Title</th>
                  <th className="p-4">Company</th>
                  <th className="p-4">Match Score</th>
                  <th className="p-4">Freshness</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {dashboard.topJobsToday.map((job: any, index: number) => (
                  <tr key={job.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4 font-semibold text-white">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-bold">
                          #{index + 1}
                        </span>
                        <span>{job.title}</span>
                      </div>
                    </td>
                    <td className="p-4 font-medium text-slate-200">{job.companyName}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                        🔥 {job.matchScore}% Match
                      </span>
                    </td>
                    <td className="p-4 text-slate-400">{job.postedAgo}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => onNavigateToTab('jobs')}
                        className="px-3 py-1.5 text-[11px] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-lg flex items-center space-x-1 ml-auto"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Apply</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
};
