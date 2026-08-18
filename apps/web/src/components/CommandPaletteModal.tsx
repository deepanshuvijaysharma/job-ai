import React, { useState } from 'react';
import { Search, X, Sparkles, Command, ArrowRight, Building2, Flame } from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectResultJob: (job: any) => void;
}

export const CommandPaletteModal: React.FC<Props> = ({ isOpen, onClose, onSelectResultJob }) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<any | null>(null);
  const [executing, setExecuting] = useState(false);

  if (!isOpen) return null;

  const quickCommands = [
    'Find my best 20 jobs today.',
    'Find jobs where I have >85% match.',
    'Find jobs where recruiters are identifiable.',
    'Find applications that need follow-up.'
  ];

  const handleRunCommand = async (cmdText: string) => {
    try {
      setExecuting(true);
      const res = await apiClient.post('/features/command', { query: cmdText });
      setResult(res.data);
    } catch (err) {
      console.error('Failed to run AI command', err);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div className="bg-dark-800 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 relative">
        
        {/* Command Input */}
        <div className="relative flex items-center border-b border-slate-800 pb-3">
          <Command className="w-5 h-5 text-brand-400 mr-3" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && query) handleRunCommand(query); }}
            placeholder="Type AI command e.g. 'Find my best 20 jobs today' or press quick command..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Command Chips */}
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Suggested AI Commands</span>
          <div className="flex flex-wrap gap-2">
            {quickCommands.map((cmd, i) => (
              <button
                key={i}
                onClick={() => { setQuery(cmd); handleRunCommand(cmd); }}
                className="px-2.5 py-1 bg-dark-900 hover:bg-slate-800 text-slate-300 text-xs rounded-lg border border-slate-800 flex items-center space-x-1 transition"
              >
                <Sparkles className="w-3 h-3 text-brand-400" />
                <span>{cmd}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Command Results */}
        {executing ? (
          <div className="py-8 text-center text-xs text-slate-400">Executing AI command...</div>
        ) : result && (
          <div className="space-y-3 pt-2">
            <div className="text-xs text-brand-300 bg-brand-500/10 p-3 rounded-xl border border-brand-500/20">
              <strong>AI Command Output:</strong> {result.interpretation} ({result.matchedCount} results)
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {result.data?.map((item: any, i: number) => (
                <div
                  key={i}
                  onClick={() => { onClose(); onSelectResultJob(item); }}
                  className="bg-dark-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between hover:border-slate-700 cursor-pointer text-xs"
                >
                  <div>
                    <div className="font-bold text-white">{item.title || item.jobTitle}</div>
                    <div className="text-[11px] text-slate-400">{item.companyName} • {item.location || 'Remote'}</div>
                  </div>
                  {item.matchScore && (
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded-full border border-red-500/30">
                      🔥 {item.matchScore.overallScore}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
