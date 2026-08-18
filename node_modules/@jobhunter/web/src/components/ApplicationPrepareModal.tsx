import React, { useEffect, useState } from 'react';
import { X, FileText, CheckCircle, Sparkles, Copy, ExternalLink } from 'lucide-react';
import { JobDTO } from '@jobhunter/types';
import { apiClient } from '../services/apiClient';

interface Props {
  job: JobDTO;
  onClose: () => void;
  onMarkApplied: (jobId: string) => void;
}

export const ApplicationPrepareModal: React.FC<Props> = ({ job, onClose, onMarkApplied }) => {
  const [prepData, setPrepData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    async function loadPrep() {
      try {
        const res = await apiClient.get(`/applications/prepare/${job.id}`);
        setPrepData(res.data);
      } catch (err) {
        console.error('Failed to load prep data', err);
      } finally {
        setLoading(false);
      }
    }
    loadPrep();
  }, [job.id]);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-dark-800 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
                APPLICATION PREPARATION ASSISTANT
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">{job.title}</h2>
            <p className="text-xs text-slate-400">{job.companyName} • {job.location}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <Sparkles className="w-8 h-8 mx-auto animate-spin text-brand-500 mb-2" />
            <p className="text-sm">Analyzing job requirements & generating application recommendations...</p>
          </div>
        ) : (
          <div className="space-y-6 text-sm text-slate-200">
            
            {/* Multi-Resume Version Match Comparison */}
            <div className="bg-dark-900 border border-slate-800 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-brand-400" />
                  <span>Resume Version Match Comparison</span>
                </span>
                <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>AI Selected Best Version</span>
                </span>
              </div>

              <div className="space-y-2">
                {prepData?.allResumeMatches?.map((m: any, i: number) => (
                  <div key={i} className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                    m.isRecommended ? 'bg-brand-500/10 border-brand-500/40 text-white font-bold' : 'bg-dark-800 border-slate-800 text-slate-300'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold">{m.resumeTitle}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{m.targetRole}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`font-extrabold text-sm ${m.matchScore >= 85 ? 'text-emerald-400' : m.matchScore >= 70 ? 'text-brand-400' : 'text-slate-400'}`}>
                        {m.matchScore}% Match
                      </span>
                      {m.isRecommended && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                          RECOMMENDED 🔥
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Keyword Emphases */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Keywords to Emphasize</h3>
              <div className="flex flex-wrap gap-2">
                {prepData?.suggestedKeywordEmphases?.map((kw: string, i: number) => (
                  <span key={i} className="px-2.5 py-1 bg-slate-800 text-brand-300 text-xs rounded-lg border border-slate-700">
                    +{kw}
                  </span>
                ))}
              </div>
            </div>

            {/* Suggested Answers */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>AI Suggested Answers to Application Questions</span>
                <span className="text-[10px] text-slate-500 font-normal">Review before submitting</span>
              </h3>

              {prepData?.suggestedAnswers?.map((qa: any, index: number) => (
                <div key={index} className="bg-dark-900 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
                  <div className="text-xs font-semibold text-white">{qa.question}</div>
                  <div className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 relative">
                    {qa.answer}
                    <button
                      onClick={() => copyToClipboard(qa.answer, index)}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white bg-slate-800 rounded hover:bg-slate-700"
                      title="Copy Answer"
                    >
                      {copiedIndex === index ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <a
                href={job.applicationUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700"
              >
                <span>Open Application Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <div className="flex items-center space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onMarkApplied(job.id);
                    onClose();
                  }}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-600/20"
                >
                  Mark as Applied
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
