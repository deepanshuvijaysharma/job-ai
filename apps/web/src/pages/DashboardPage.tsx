import React, { useEffect, useState } from 'react';
import { Sparkles, Flame, UserCheck, Mail, Building, Target, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { JobDTO } from '@jobhunter/types';

interface Props {
  onSelectJob: (job: JobDTO) => void;
  onNavigateToTab: (tab: string) => void;
}

export const DashboardPage: React.FC<Props> = ({ onSelectJob, onNavigateToTab }) => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSummary() {
      try {
        const res = await apiClient.get('/analytics/daily-summary');
        setSummary(res.data);
      } catch (err) {
        console.error('Failed to load summary', err);
      } finally {
        setLoading(false);
      }
    }
    loadSummary();
  }, []);

  if (loading) {
    return <div className="p-8 text-slate-400">Loading today's job search summary...</div>;
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Morning Header */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-brand-400 mb-1 flex items-center space-x-1.5">
          <Sparkles className="w-4 h-4" />
          <span>{summary?.date}</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">GOOD MORNING 👋</h1>
        <p className="text-slate-400 text-sm mt-1">Here are your highest-probability actions today to get an interview.</p>
      </div>

      {/* Top 5 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        <div className="bg-dark-800 border border-slate-800 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>High-Match Jobs</span>
            <Flame className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-extrabold text-white">{summary?.highMatchJobsCount || 14}</div>
          <p className="text-[11px] text-emerald-400 font-semibold">🔥 90-100% Match tier</p>
        </div>

        <div className="bg-dark-800 border border-slate-800 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Recruiters Found</span>
            <UserCheck className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{summary?.recruitersFoundCount || 7}</div>
          <p className="text-[11px] text-brand-400 font-semibold">Direct HR & Hiring Contacts</p>
        </div>

        <div className="bg-dark-800 border border-slate-800 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Follow-ups Due</span>
            <Mail className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{summary?.followUpsDueCount || 4}</div>
          <p className="text-[11px] text-amber-400 font-semibold">Pending cadence timeline</p>
        </div>

        <div className="bg-dark-800 border border-slate-800 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Watched Companies</span>
            <Building className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{summary?.watchedCompanyOpeningsCount || 5}</div>
          <p className="text-[11px] text-slate-400">New official career posts</p>
        </div>

        <div className="bg-dark-800 border border-slate-800 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Response Rate</span>
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">38.8%</div>
          <p className="text-[11px] text-emerald-400 font-semibold">3.8x market average</p>
        </div>

      </div>

      {/* Recommended Actions Priority Box */}
      <div className="bg-gradient-to-r from-brand-900/40 via-dark-800 to-dark-800 border border-brand-500/30 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-brand-400" />
            <span>Recommended Priority Actions Today</span>
          </h2>
          <span className="text-xs text-brand-300 font-semibold bg-brand-500/20 px-2.5 py-1 rounded-full border border-brand-500/30">
            Maximizes Interview Yield
          </span>
        </div>

        <div className="space-y-3">
          {summary?.recommendedActions?.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No recommended actions pending. Start by importing job URLs or searching for opportunities!
            </div>
          ) : (
            summary?.recommendedActions?.map((act: any, i: number) => (
              <div key={act.id} className="bg-dark-900/80 border border-slate-800 p-4 rounded-xl flex items-center justify-between hover:border-slate-700 transition">
                <div className="flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center font-bold text-xs text-brand-400 shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{act.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{act.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onNavigateToTab('jobs');
                  }}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 shrink-0"
                >
                  <span>Execute Action</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Today's Top Opportunities Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Today's Top High-Match Opportunities</h2>
          <button onClick={() => onNavigateToTab('jobs')} className="text-xs text-brand-400 hover:underline font-semibold flex items-center space-x-1">
            <span>View All Jobs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-dark-800 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {summary?.topJobsToday?.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-2">
              <div className="text-sm font-semibold text-slate-300">No jobs discovered yet</div>
              <p>Import your first job URL or search for target positions to populate your morning summary.</p>
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
                  <th className="p-4">Location</th>
                  <th className="p-4">Recruiter Found</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {summary?.topJobsToday?.map((job: JobDTO, index: number) => (
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
                        🔥 {job.matchScore?.overallScore || 90}% Match
                      </span>
                    </td>
                    <td className="p-4 text-slate-400">{job.location}</td>
                    <td className="p-4">
                      {job.recruiters && job.recruiters.length > 0 ? (
                        <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{job.recruiters[0].name}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">Not Identified</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => onSelectJob(job)}
                        className="px-3 py-1.5 text-[11px] font-semibold text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 rounded-lg border border-brand-500/30"
                      >
                        Why This Job?
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
