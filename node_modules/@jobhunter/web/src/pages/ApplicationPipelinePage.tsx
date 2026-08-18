import React, { useEffect, useState } from 'react';
import { Kanban, Clock, ChevronRight, CheckCircle2, UserCheck, Calendar, Sparkles } from 'lucide-react';
import { ApplicationStatus } from '@jobhunter/types';
import { apiClient } from '../services/apiClient';

const STAGES = [
  { id: ApplicationStatus.DISCOVERED, label: 'Discovered', color: 'border-slate-700 bg-slate-900/40' },
  { id: ApplicationStatus.SHORTLISTED, label: 'Shortlisted', color: 'border-brand-500/30 bg-brand-950/20' },
  { id: ApplicationStatus.APPLIED, label: 'Applied', color: 'border-blue-500/30 bg-blue-950/20' },
  { id: ApplicationStatus.RECRUITER_CONTACTED, label: 'Recruiter Contacted', color: 'border-amber-500/30 bg-amber-950/20' },
  { id: ApplicationStatus.INTERVIEW_SCHEDULED, label: 'Interview Scheduled', color: 'border-purple-500/30 bg-purple-950/20' },
  { id: ApplicationStatus.OFFER, label: 'Offer Received 🎉', color: 'border-emerald-500/30 bg-emerald-950/20' },
];

export const ApplicationPipelinePage: React.FC = () => {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApps = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/applications');
      setApplications(res.data);
    } catch (err) {
      console.error('Failed to fetch applications', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const moveStatus = async (jobId: string, nextStatus: ApplicationStatus) => {
    try {
      await apiClient.post('/applications/status', { jobId, status: nextStatus });
      fetchApps();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center space-x-2">
            <Kanban className="w-6 h-6 text-brand-400" />
            <span>Application & Interview Pipeline</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">Track every application, recruiter interaction, follow-up cadence, and scheduled interview.</p>
        </div>
      </div>

      {/* Kanban Board Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">Loading application pipeline board...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-start overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageApps = applications.filter(a => a.status === stage.id);
            return (
              <div key={stage.id} className={`border rounded-2xl p-3 space-y-3 min-h-[500px] ${stage.color}`}>
                
                {/* Column Header */}
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">{stage.label}</h3>
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-bold text-[10px] flex items-center justify-center">
                    {stageApps.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="space-y-3">
                  {stageApps.map((app) => {
                    const job = app.job;
                    return (
                      <div key={app.id} className="bg-dark-800 border border-slate-800 p-3.5 rounded-xl space-y-2.5 shadow-md hover:border-slate-700 transition">
                        
                        {/* Match score badge */}
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-extrabold text-brand-400">
                            {job?.matchScore?.overallScore || 90}% Match
                          </span>
                          <span className="text-slate-500">{job?.source || 'Naukri'}</span>
                        </div>

                        {/* Title & Company */}
                        <div>
                          <div className="text-xs font-bold text-white leading-snug">{job?.title || 'Backend Engineer'}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{job?.companyName || 'Acme Corp'}</div>
                        </div>

                        {/* Applied date or timeline */}
                        <div className="text-[10px] text-slate-500 flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Updated {new Date(app.updatedAt).toLocaleDateString()}</span>
                        </div>

                        {/* Quick Move Status Action */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                          <span className="text-slate-500 font-medium">Advance Status</span>
                          <div className="flex items-center space-x-1">
                            {stage.id === ApplicationStatus.DISCOVERED && (
                              <button
                                onClick={() => moveStatus(job.id, ApplicationStatus.SHORTLISTED)}
                                className="px-2 py-1 bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 rounded font-semibold flex items-center space-x-0.5"
                              >
                                <span>Shortlist</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                            {stage.id === ApplicationStatus.SHORTLISTED && (
                              <button
                                onClick={() => moveStatus(job.id, ApplicationStatus.APPLIED)}
                                className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded font-semibold flex items-center space-x-0.5"
                              >
                                <span>Applied</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                            {stage.id === ApplicationStatus.APPLIED && (
                              <button
                                onClick={() => moveStatus(job.id, ApplicationStatus.RECRUITER_CONTACTED)}
                                className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded font-semibold flex items-center space-x-0.5"
                              >
                                <span>Outreach</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                            {stage.id === ApplicationStatus.RECRUITER_CONTACTED && (
                              <button
                                onClick={() => moveStatus(job.id, ApplicationStatus.INTERVIEW_SCHEDULED)}
                                className="px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded font-semibold flex items-center space-x-0.5"
                              >
                                <span>Interview</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                            {stage.id === ApplicationStatus.INTERVIEW_SCHEDULED && (
                              <button
                                onClick={() => moveStatus(job.id, ApplicationStatus.OFFER)}
                                className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded font-semibold flex items-center space-x-0.5"
                              >
                                <span>Offer!</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
