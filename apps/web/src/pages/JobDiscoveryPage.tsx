import React, { useEffect, useState } from 'react';
import { Search, Plus, Filter, Flame, CheckCircle, Building2, MapPin, DollarSign, Briefcase, UserCheck, Sparkles } from 'lucide-react';
import { JobDTO } from '@jobhunter/types';
import { apiClient } from '../services/apiClient';

interface Props {
  onSelectJob: (job: JobDTO) => void;
  onPrepareJob: (job: JobDTO) => void;
}

export const JobDiscoveryPage: React.FC<Props> = ({ onSelectJob, onPrepareJob }) => {
  const [jobs, setJobs] = useState<JobDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [showImportModal, setShowImportModal] = useState(false);

  // Import Form State
  const [importUrl, setImportUrl] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [importCompany, setImportCompany] = useState('');
  const [importing, setImporting] = useState(false);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (search) params.search = search;
      if (selectedPriority !== 'ALL') params.priority = selectedPriority;

      const res = await apiClient.get('/jobs', { params });
      setJobs(res.data);
    } catch (err) {
      console.error('Failed to fetch jobs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [search, selectedPriority]);

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl || !importTitle || !importCompany) return;

    try {
      setImporting(true);
      await apiClient.post('/jobs/import', {
        url: importUrl,
        title: importTitle,
        companyName: importCompany
      });
      setShowImportModal(false);
      setImportUrl('');
      setImportTitle('');
      setImportCompany('');
      fetchJobs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to import job');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">AI Job Discovery & Match Prioritization</h1>
          <p className="text-slate-400 text-xs mt-1">Jobs automatically ingested, deduplicated, and ranked by match score.</p>
        </div>
        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={async () => {
              try {
                setLoading(true);
                await apiClient.post('/jobs/discover', { roles: ['Backend Developer', 'Node.js Developer'] });
                await fetchJobs();
              } catch (err) {
                console.error('Discovery error', err);
              } finally {
                setLoading(false);
              }
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-2 shadow-lg shadow-emerald-600/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>Run Auto-Discovery 🚀</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-2 shadow-lg shadow-brand-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Import Job URL</span>
          </button>
        </div>
      </div>

      {/* Search Bar & Priority Tier Tabs */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Natural language search e.g. 'Backend Node.js jobs in Noida with SQL above ₹6 LPA'..."
            className="w-full bg-dark-800 border border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition"
          />
        </div>

        {/* Priority Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold mr-2 flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Priority:</span>
          </span>

          {[
            { id: 'ALL', label: 'All Jobs' },
            { id: 'APPLY_NOW', label: '🔥 Apply Now (90-100%)', badge: 'bg-red-500/20 text-red-400' },
            { id: 'STRONG_MATCH', label: '🟢 Strong Match (80-89%)', badge: 'bg-emerald-500/20 text-emerald-400' },
            { id: 'POSSIBLE', label: '🟡 Possible (65-79%)', badge: 'bg-amber-500/20 text-amber-400' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedPriority(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                selectedPriority === tab.id
                  ? 'bg-brand-600 text-white border-brand-500'
                  : 'bg-dark-800 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">Searching and scoring matching job opportunities...</div>
      ) : jobs.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-sm bg-dark-800 border border-slate-800 rounded-2xl">
          No jobs found matching your current filter criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((job) => {
            const match = job.matchScore;
            return (
              <div key={job.id} className="bg-dark-800 border border-slate-800 p-5 rounded-2xl space-y-4 hover:border-slate-700 transition shadow-lg flex flex-col justify-between">
                
                <div className="space-y-3">
                  
                  {/* Top Bar: Priority Badge + Match Score */}
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full uppercase tracking-wider ${
                      match?.priority === 'APPLY_NOW' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                      match?.priority === 'STRONG_MATCH' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {match?.priority === 'APPLY_NOW' ? '🔥 APPLY NOW' : match?.priority === 'STRONG_MATCH' ? '🟢 STRONG MATCH' : '🟡 POSSIBLE'}
                    </span>
                    <span className="text-sm font-extrabold text-white">
                      {match?.overallScore || 85}% Match
                    </span>
                  </div>

                  {/* Title & Company */}
                  <div>
                    <h3 className="text-base font-bold text-white">{job.title}</h3>
                    <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                      <span className="font-semibold text-slate-200">{job.companyName}</span>
                      <span>•</span>
                      <span>{job.source}</span>
                    </div>
                  </div>

                  {/* Details Badges */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                    <span className="flex items-center space-x-1"><MapPin className="w-3.5 h-3.5 text-slate-500" /><span>{job.location}</span></span>
                    <span className="flex items-center space-x-1"><Briefcase className="w-3.5 h-3.5 text-slate-500" /><span>{job.experienceMin || 1}-{job.experienceMax || 3} yrs</span></span>
                    <span className="flex items-center space-x-1"><DollarSign className="w-3.5 h-3.5 text-slate-500" /><span>₹{((job.salaryMin || 600000)/100000).toFixed(1)}-{((job.salaryMax || 1200000)/100000).toFixed(1)} LPA</span></span>
                  </div>

                  {/* Required Skills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {job.requiredSkills.map((sk, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-900 text-slate-300 text-[10px] font-medium rounded-md border border-slate-800">
                        {sk}
                      </span>
                    ))}
                  </div>

                  {/* Recruiter Found Badge */}
                  <div className="pt-2">
                    {job.recruiters && job.recruiters.length > 0 ? (
                      <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs text-emerald-400">
                        <span className="flex items-center space-x-1.5 font-semibold">
                          <UserCheck className="w-4 h-4" />
                          <span>Recruiter: {job.recruiters[0].name} ({job.recruiters[0].role})</span>
                        </span>
                        <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded font-bold">FOUND ✓</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic">No recruiter contract identified yet</div>
                    )}
                  </div>

                </div>

                {/* Card Action Buttons */}
                <div className="pt-4 border-t border-slate-800 flex items-center space-x-2">
                  <button
                    onClick={() => onSelectJob(job)}
                    className="flex-1 py-2 text-xs font-semibold text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 rounded-xl border border-brand-500/30 transition"
                  >
                    Why This Job?
                  </button>
                  <button
                    onClick={() => onPrepareJob(job)}
                    className="flex-1 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg shadow-brand-600/20 transition"
                  >
                    Prepare Application
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Import Job URL Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Import Job Page URL</h2>
            <p className="text-xs text-slate-400">Paste any public job URL (Greenhouse, Lever, Company Career page, etc.). JobHunter AI will extract details and evaluate match.</p>

            <form onSubmit={handleImportSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Job Application URL *</label>
                <input
                  type="url"
                  required
                  value={importUrl}
                  onChange={e => setImportUrl(e.target.value)}
                  placeholder="https://careers.company.com/job/123"
                  className="w-full bg-dark-900 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={importTitle}
                  onChange={e => setImportTitle(e.target.value)}
                  placeholder="e.g. Backend Node.js Developer"
                  className="w-full bg-dark-900 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={importCompany}
                  onChange={e => setImportCompany(e.target.value)}
                  placeholder="e.g. Acme Tech"
                  className="w-full bg-dark-900 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importing}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl"
                >
                  {importing ? 'Importing...' : 'Import & Score'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
