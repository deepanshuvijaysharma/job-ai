import React, { useEffect, useState } from 'react';
import { Mail, CheckCircle2, UserCheck, Edit3, RefreshCw, XCircle, ShieldAlert, Sparkles, Send, Clock, AlertCircle } from 'lucide-react';
import { apiClient } from '../services/apiClient';

export const RecruiterOutreachPage: React.FC = () => {
  const [queueData, setQueueData] = useState<any>(null);
  const [followups, setFollowups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingMsg, setEditingMsg] = useState<any | null>(null);
  const [editBody, setEditBody] = useState('');

  const fetchOutreachData = async () => {
    try {
      setLoading(true);
      const [qRes, fRes] = await Promise.all([
        apiClient.get('/outreach/approval-queue'),
        apiClient.get('/outreach/followups')
      ]);
      setQueueData(qRes.data);
      setFollowups(fRes.data);
    } catch (err) {
      console.error('Failed to load outreach data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutreachData();
  }, []);

  const handleApprove = async (msgId: string) => {
    try {
      await apiClient.post('/outreach/approve', { messageIds: [msgId] });
      fetchOutreachData();
    } catch (err) {
      console.error('Failed to approve message', err);
    }
  };

  const handleApproveSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      await apiClient.post('/outreach/approve', { messageIds: selectedIds });
      setSelectedIds([]);
      fetchOutreachData();
    } catch (err) {
      console.error('Failed to approve selected', err);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMsg) return;
    try {
      await apiClient.post('/outreach/edit', {
        messageId: editingMsg.id,
        body: editBody
      });
      setEditingMsg(null);
      fetchOutreachData();
    } catch (err) {
      console.error('Failed to edit message', err);
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400">Loading recruiter outreach approval queue...</div>;
  }

  const pendingMessages = queueData?.pending || [];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center space-x-2">
            <Mail className="w-6 h-6 text-brand-400" />
            <span>Recruiter Outreach & Approval Queue</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">Review, customize, and approve AI-generated recruiter messages before dispatch.</p>
        </div>

        {/* Daily Rate Limit Guard */}
        <div className="bg-dark-800 border border-slate-800 px-4 py-2.5 rounded-2xl flex items-center space-x-3 text-xs">
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-semibold">Daily Outreach Limit</div>
            <div className="text-white font-bold">{queueData?.approvedCount || 0} / {queueData?.dailyLimit || 10} Approved</div>
          </div>
          <div className="w-12 bg-dark-900 h-2 rounded-full overflow-hidden border border-slate-800">
            <div className="bg-brand-500 h-full rounded-full" style={{ width: `${((queueData?.approvedCount || 0) / 10) * 100}%` }}></div>
          </div>
        </div>
      </div>

      {/* Compliance Guarantee Banner */}
      <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center space-x-3 text-xs text-emerald-400">
        <ShieldAlert className="w-5 h-5 shrink-0 text-emerald-400" />
        <div>
          <span className="font-bold">Human Approval Enforced:</span> No email is ever sent without your explicit review and confirmation. Rate limits prevent mass spam and protect recruiter reputation.
        </div>
      </div>

      {/* Multi-Approve Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-brand-900/40 border border-brand-500/30 p-4 rounded-2xl flex items-center justify-between">
          <span className="text-xs font-semibold text-brand-200">
            {selectedIds.length} draft messages selected for batch approval
          </span>
          <button
            onClick={handleApproveSelected}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-brand-600/20"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Approve & Send Selected ({selectedIds.length})</span>
          </button>
        </div>
      )}

      {/* Pending Approval Queue */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center justify-between">
          <span>Pending Messages ({pendingMessages.length})</span>
          {pendingMessages.length > 1 && (
            <button
              onClick={() => {
                if (selectedIds.length === pendingMessages.length) setSelectedIds([]);
                else setSelectedIds(pendingMessages.map((m: any) => m.id));
              }}
              className="text-xs text-brand-400 font-semibold hover:underline"
            >
              {selectedIds.length === pendingMessages.length ? 'Deselect All' : 'Select All Messages'}
            </button>
          )}
        </h2>

        {pendingMessages.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm bg-dark-800 border border-slate-800 rounded-2xl">
            🎉 All recruiter outreach messages have been reviewed! No pending drafts.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingMessages.map((msg: any) => {
              const isSelected = selectedIds.includes(msg.id);
              return (
                <div key={msg.id} className={`bg-dark-800 border rounded-2xl p-5 space-y-4 transition ${isSelected ? 'border-brand-500 bg-brand-950/10' : 'border-slate-800 hover:border-slate-700'}`}>
                  
                  {/* Top Row: Checkbox, Recruiter Info, Confidence */}
                  <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(msg.id)}
                        className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-600 focus:ring-brand-500"
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                            <UserCheck className="w-4 h-4 text-brand-400" />
                            <span>{msg.recruiterName}</span>
                          </h3>
                          <span className="text-xs text-slate-400">({msg.recruiterRole})</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Job: <span className="font-semibold text-slate-200">{msg.jobTitle}</span> at <span className="font-semibold text-slate-200">{msg.companyName}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="px-2.5 py-1 bg-brand-500/10 text-brand-400 border border-brand-500/20 text-[10px] font-bold rounded-full">
                        {Math.round(msg.confidence * 100)}% Recruiter Relevance
                      </span>
                    </div>
                  </div>

                  {/* AI Reasoning */}
                  <div className="text-xs text-brand-300 bg-brand-500/10 p-2.5 rounded-xl border border-brand-500/20 flex items-start space-x-2">
                    <Sparkles className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                    <span><strong>AI Rationale:</strong> {msg.aiReasoning}</span>
                  </div>

                  {/* Subject & Body Draft */}
                  <div className="bg-dark-900 border border-slate-800 p-4 rounded-xl space-y-2 text-xs">
                    <div className="text-slate-400 font-semibold">Subject: <span className="text-white font-bold">{msg.subject}</span></div>
                    <div className="text-slate-300 font-mono whitespace-pre-wrap pt-2 border-t border-slate-800/80 leading-relaxed">
                      {msg.body}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center space-x-2 text-xs">
                      <button
                        onClick={() => {
                          setEditingMsg(msg);
                          setEditBody(msg.body);
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 flex items-center space-x-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Draft</span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleApprove(msg.id)}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Approve & Send</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Due Follow-ups Timeline */}
      {followups.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <span>Follow-ups Due Today ({followups.length})</span>
          </h2>

          <div className="space-y-3">
            {followups.map((fol) => (
              <div key={fol.id} className="bg-dark-800 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Day {fol.stepNumber * 2} Follow-up: {fol.jobTitle} at {fol.companyName}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Recruiter: {fol.recruiterName} ({fol.recruiterRole})</div>
                </div>
                <button
                  onClick={() => alert(`Drafting follow-up email for ${fol.recruiterName}`)}
                  className="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-xs rounded-xl border border-amber-500/30"
                >
                  Generate Follow-up Draft
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Draft Modal */}
      {editingMsg && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Edit Outreach Email Draft</h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Subject Line</label>
                <input
                  type="text"
                  disabled
                  value={editingMsg.subject}
                  className="w-full bg-dark-900 border border-slate-800 rounded-xl p-2.5 text-slate-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email Content Body</label>
                <textarea
                  rows={8}
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  className="w-full bg-dark-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-brand-500 font-mono text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  onClick={() => setEditingMsg(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl"
                >
                  Save Draft Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
