import React from 'react';
import { X, CheckCircle2, AlertTriangle, Sparkles, Building2, MapPin, DollarSign, Briefcase } from 'lucide-react';
import { JobDTO } from '@jobhunter/types';

interface Props {
  job: JobDTO;
  onClose: () => void;
  onPrepare: (job: JobDTO) => void;
}

export const WhyThisJobModal: React.FC<Props> = ({ job, onClose, onPrepare }) => {
  const match = job.matchScore;
  if (!match) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-dark-800 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase tracking-wider ${
                match.priority === 'APPLY_NOW' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                match.priority === 'STRONG_MATCH' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {match.priority === 'APPLY_NOW' ? '🔥 APPLY NOW' : match.priority === 'STRONG_MATCH' ? '🟢 STRONG MATCH' : '🟡 POSSIBLE'}
              </span>
              <span className="text-xs text-slate-400">Match Score: <span className="font-bold text-white text-sm">{match.overallScore}%</span></span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">{job.title}</h2>
            <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
              <span className="flex items-center space-x-1"><Building2 className="w-3.5 h-3.5" /><span>{job.companyName}</span></span>
              <span className="flex items-center space-x-1"><MapPin className="w-3.5 h-3.5" /><span>{job.location}</span></span>
              <span className="flex items-center space-x-1"><Briefcase className="w-3.5 h-3.5" /><span>{job.experienceMin || 1}-{job.experienceMax || 3} yrs</span></span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 10-Metric Match Breakdown Grid */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-brand-500" />
            <span>Match Score Breakdown</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Skill Match', val: match.breakdown.skillMatch },
              { label: 'Role Match', val: match.breakdown.roleMatch },
              { label: 'Experience', val: match.breakdown.experienceMatch },
              { label: 'Location', val: match.breakdown.locationMatch },
              { label: 'Resume Keywords', val: match.breakdown.resumeKeywordMatch },
              { label: 'Projects', val: match.breakdown.projectMatch },
              { label: 'Salary', val: match.breakdown.salaryMatch },
              { label: 'Education', val: match.breakdown.educationMatch },
            ].map((m, i) => (
              <div key={i} className="bg-dark-900 border border-slate-800 p-2.5 rounded-xl text-center">
                <div className="text-xs text-slate-400">{m.label}</div>
                <div className="text-base font-bold text-slate-100 mt-0.5">{m.val}%</div>
                <div className="w-full bg-slate-800 h-1 rounded-full mt-1 overflow-hidden">
                  <div className="bg-brand-500 h-full rounded-full" style={{ width: `${m.val}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Why You Match */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>Why You Match</span>
          </h3>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {match.whyApply.map((point, i) => (
              <li key={i} className="flex items-start space-x-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Potential Weaknesses */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>Potential Weaknesses / Considerations</span>
          </h3>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {match.whatHoldsBack.map((point, i) => (
              <li key={i} className="flex items-start space-x-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Recommendation & Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">AI Recommendation:</div>
            <div className="text-sm font-bold text-brand-400">
              {match.overallScore >= 90 ? 'APPLY IMMEDIATELY + CONTACT RECRUITER' : 'RECOMMENDED APPLY — HIGH ALIGNMENT'}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl hover:bg-slate-800"
            >
              Close
            </button>
            <button
              onClick={() => { onClose(); onPrepare(job); }}
              className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg shadow-brand-600/20"
            >
              Prepare Application
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
