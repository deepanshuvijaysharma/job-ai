import React, { useEffect, useState } from 'react';
import { UserCheck, FileText, Upload, Sparkles, CheckCircle2, AlertTriangle, XCircle, Plus, Trash2 } from 'lucide-react';
import { CandidateProfileDTO, ResumeDTO } from '@jobhunter/types';
import { apiClient } from '../services/apiClient';

export const CandidateProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<CandidateProfileDTO | null>(null);
  const [resumes, setResumes] = useState<ResumeDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // Resume Upload Form State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [resumeTitle, setResumeTitle] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [uploading, setUploading] = useState(false);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const [profRes, resRes] = await Promise.all([
        apiClient.get('/profile'),
        apiClient.get('/profile/resumes')
      ]);
      setProfile(profRes.data);
      setResumes(resRes.data);
    } catch (err) {
      console.error('Failed to load candidate profile', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  const handleResumeUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeTitle || !resumeText) return;

    try {
      setUploading(true);
      await apiClient.post('/profile/resumes/upload', {
        title: resumeTitle,
        rawText: resumeText
      });
      setShowUploadModal(false);
      setResumeTitle('');
      setResumeText('');
      fetchProfileData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to upload resume');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400">Loading candidate profile & resume intelligence...</div>;
  }

  const aiAnalysis = profile?.aiProfileAnalysis;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center space-x-2">
            <UserCheck className="w-6 h-6 text-brand-400" />
            <span>Candidate Profile & Multi-Resume Intelligence</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">Manage multiple tailored resumes, skills, preferred locations, and AI market competitiveness analysis.</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-2 shadow-lg shadow-brand-600/20"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Resume PDF/DOCX</span>
        </button>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-dark-800 border border-slate-800 p-6 rounded-2xl space-y-6">
        <h2 className="text-base font-bold text-white border-b border-slate-800 pb-3">Core Candidate Profile</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block mb-1">Target Roles</span>
            <div className="flex flex-wrap gap-1.5">
              {profile?.targetRoles.map((r, i) => (
                <span key={i} className="px-2.5 py-1 bg-brand-500/10 text-brand-300 font-semibold rounded-lg border border-brand-500/20">
                  {r}
                </span>
              ))}
            </div>
          </div>

          <div>
            <span className="text-slate-400 block mb-1">Preferred Locations</span>
            <div className="flex flex-wrap gap-1.5">
              {profile?.preferredLocations.map((l, i) => (
                <span key={i} className="px-2.5 py-1 bg-slate-900 text-slate-300 rounded-lg border border-slate-800">
                  {l}
                </span>
              ))}
            </div>
          </div>

          <div>
            <span className="text-slate-400 block mb-1">Experience & Salary Expectation</span>
            <div className="text-white font-bold text-sm">
              {profile?.experienceYears} Years commercial experience
            </div>
            <div className="text-slate-400 text-xs mt-0.5">
              ₹{((profile?.salaryMin || 600000)/100000).toFixed(1)}L - ₹{((profile?.salaryMax || 1200000)/100000).toFixed(1)}L LPA • {profile?.noticePeriodDays} Days notice
            </div>
          </div>
        </div>

        {/* Skills Graph */}
        <div>
          <span className="text-xs text-slate-400 block mb-2 font-semibold uppercase tracking-wider">Candidate Skills & Proficiency Graph</span>
          <div className="flex flex-wrap gap-2">
            {profile?.skills.map((sk, i) => (
              <span key={i} className="px-3 py-1.5 bg-dark-900 text-slate-200 text-xs font-semibold rounded-xl border border-slate-800 flex items-center space-x-2">
                <span>{sk.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  sk.proficiencyLevel === 'STRONG' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  sk.proficiencyLevel === 'INTERMEDIATE' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' :
                  sk.proficiencyLevel === 'BASIC' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {sk.proficiencyLevel || 'INTERMEDIATE'} ({sk.yearsExperience}y)
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Multi-Resumes Manager */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center space-x-2">
          <FileText className="w-5 h-5 text-brand-400" />
          <span>Tailored Multi-Resume Versions ({resumes.length})</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {resumes.map((res) => (
            <div key={res.id} className="bg-dark-800 border border-slate-800 p-4 rounded-2xl space-y-3 relative hover:border-slate-700 transition">
              {res.isDefault && (
                <span className="absolute top-3 right-3 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/30">
                  DEFAULT RESUME
                </span>
              )}
              <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-white">{res.title}</h3>
                  <span className="px-2 py-0.5 bg-slate-900 text-brand-300 text-[10px] rounded font-mono border border-slate-700">{res.version || 'v1.0'}</span>
                </div>
                <p className="text-xs text-brand-400 font-semibold mt-0.5">{res.targetRole || 'Software Engineer'}</p>
                <p className="text-[11px] text-slate-400 mt-1">Uploaded {new Date(res.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Market Competitiveness Analysis */}
      {aiAnalysis && (
        <div className="bg-dark-800 border border-slate-800 p-6 rounded-2xl space-y-6">
          <div className="flex items-center space-x-2 text-brand-400 border-b border-slate-800 pb-3">
            <Sparkles className="w-5 h-5" />
            <h2 className="text-base font-bold text-white">AI Profile Competitiveness Analysis</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Strong Skills */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Strong & Marketable Skills</span>
              </h3>
              <div className="space-y-1 text-xs text-slate-300">
                {aiAnalysis.strongSkills.map((s, i) => (
                  <div key={i} className="p-2 bg-dark-900 border border-slate-800 rounded-lg">
                    {s}
                  </div>
                ))}
              </div>
            </div>

            {/* Weak / Missing Skills */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Weak / Missing Skills to Add</span>
              </h3>
              <div className="space-y-1 text-xs text-slate-300">
                {aiAnalysis.missingSkills.map((s, i) => (
                  <div key={i} className="p-2 bg-dark-900 border border-slate-800 rounded-lg text-amber-300">
                    {s}
                  </div>
                ))}
              </div>
            </div>

            {/* Competitive Roles */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center space-x-1.5">
                <UserCheck className="w-4 h-4" />
                <span>Highly Competitive Roles</span>
              </h3>
              <div className="space-y-1 text-xs text-slate-300">
                {aiAnalysis.competitiveRoles.map((r, i) => (
                  <div key={i} className="p-2 bg-dark-900 border border-slate-800 rounded-lg text-brand-300 font-semibold">
                    {r}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Upload Resume Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Upload New Resume</h2>
            <p className="text-xs text-slate-400">AI will automatically parse skills, projects, and keywords to generate candidate insights.</p>

            <form onSubmit={handleResumeUpload} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Resume Title *</label>
                <input
                  type="text"
                  required
                  value={resumeTitle}
                  onChange={e => setResumeTitle(e.target.value)}
                  placeholder="e.g. AI & GenAI Software Engineer Resume"
                  className="w-full bg-dark-900 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Paste Resume Raw Text Content *</label>
                <textarea
                  required
                  rows={6}
                  value={resumeText}
                  onChange={e => setResumeText(e.target.value)}
                  placeholder="Paste raw text of your resume here..."
                  className="w-full bg-dark-900 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl"
                >
                  {uploading ? 'Parsing AI Resume...' : 'Upload & Run AI Parser'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
