import React, { useEffect, useState } from 'react';
import { Target, Sparkles, BookOpen, CheckCircle, Copy, HelpCircle } from 'lucide-react';
import { apiClient } from '../services/apiClient';

export const InterviewPrepPage: React.FC = () => {
  const [prepPlan, setPrepPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    async function loadPlan() {
      try {
        setLoading(true);
        const res = await apiClient.get('/features/interview/prep/job-101');
        setPrepPlan(res.data);
      } catch (err) {
        console.error('Failed to load interview prep plan', err);
      } finally {
        setLoading(false);
      }
    }
    loadPlan();
  }, []);

  const copyAnswer = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (loading) {
    return <div className="p-8 text-slate-400">Generating role-specific AI interview preparation plan...</div>;
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-brand-400 mb-1 flex items-center space-x-1.5">
          <Sparkles className="w-4 h-4" />
          <span>Interview Preparation Coach</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          {prepPlan?.jobTitle} — {prepPlan?.companyName}
        </h1>
        <p className="text-slate-400 text-xs mt-1">{prepPlan?.companyOverview}</p>
      </div>

      {/* Likely Topics */}
      <div className="bg-dark-800 border border-slate-800 p-5 rounded-2xl space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center space-x-2">
          <Target className="w-4 h-4 text-brand-400" />
          <span>Top Core Topics Likely to be Asked</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {prepPlan?.likelyTopics?.map((t: string, i: number) => (
            <span key={i} className="px-3 py-1.5 bg-brand-500/10 text-brand-300 border border-brand-500/20 text-xs font-semibold rounded-xl">
              #{t}
            </span>
          ))}
        </div>
      </div>

      {/* Question Bank */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-brand-400" />
          <span>Role-Specific Technical & Behavioral Practice Questions</span>
        </h2>

        <div className="space-y-4">
          {prepPlan?.questionBank?.map((q: any, index: number) => (
            <div key={index} className="bg-dark-800 border border-slate-800 p-5 rounded-2xl space-y-3 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 bg-slate-900 text-brand-400 text-[11px] font-bold rounded-lg border border-slate-800 uppercase">
                  {q.category}
                </span>
                <span className="text-[10px] text-slate-500">Question #{index + 1}</span>
              </div>

              <div className="text-sm font-bold text-white flex items-start space-x-2">
                <HelpCircle className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                <span>{q.question}</span>
              </div>

              <div className="bg-dark-900 border border-slate-800 p-3.5 rounded-xl text-xs text-slate-300 leading-relaxed relative">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">AI Suggested Answer:</div>
                {q.suggestedAnswer}
                <button
                  onClick={() => copyAnswer(q.suggestedAnswer, index)}
                  className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700"
                  title="Copy Answer"
                >
                  {copiedIndex === index ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
