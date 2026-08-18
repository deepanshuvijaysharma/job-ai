import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { JobDiscoveryPage } from './pages/JobDiscoveryPage';
import { ApplicationPipelinePage } from './pages/ApplicationPipelinePage';
import { RecruiterOutreachPage } from './pages/RecruiterOutreachPage';
import { CandidateProfilePage } from './pages/CandidateProfilePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { InterviewPrepPage } from './pages/InterviewPrepPage';
import { WhyThisJobModal } from './components/WhyThisJobModal';
import { ApplicationPrepareModal } from './components/ApplicationPrepareModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { JobDTO } from '@jobhunter/types';
import { apiClient } from './services/apiClient';
import { Command, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedMatchJob, setSelectedMatchJob] = useState<JobDTO | null>(null);
  const [selectedPrepareJob, setSelectedPrepareJob] = useState<JobDTO | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);

  // Keyboard shortcut Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMarkApplied = async (jobId: string) => {
    try {
      await apiClient.post('/applications/status', { jobId, status: 'APPLIED' });
      setActiveTab('pipeline');
    } catch (err) {
      console.error('Failed to mark as applied', err);
    }
  };

  return (
    <div className="flex min-h-screen bg-dark-900 text-slate-100 antialiased selection:bg-brand-500 selection:text-white relative">
      
      {/* Top Floating Command Palette Trigger Bar */}
      <div className="fixed top-3 right-6 z-40">
        <button
          onClick={() => setShowCommandPalette(true)}
          className="px-3.5 py-1.5 bg-dark-800/90 hover:bg-slate-800 backdrop-blur-md border border-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center space-x-2 shadow-xl"
        >
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          <span>AI Command Palette</span>
          <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-400 font-mono">Ctrl+K</kbd>
        </button>
      </div>

      {/* Navigation Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto min-h-screen">
        {activeTab === 'dashboard' && (
          <DashboardPage
            onSelectJob={(job) => setSelectedMatchJob(job)}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'jobs' && (
          <JobDiscoveryPage
            onSelectJob={(job) => setSelectedMatchJob(job)}
            onPrepareJob={(job) => setSelectedPrepareJob(job)}
          />
        )}

        {activeTab === 'outreach' && <RecruiterOutreachPage />}

        {activeTab === 'pipeline' && <ApplicationPipelinePage />}

        {activeTab === 'interview' && <InterviewPrepPage />}

        {activeTab === 'profile' && <CandidateProfilePage />}

        {activeTab === 'analytics' && <AnalyticsPage />}
      </main>

      {/* Why This Job Modal */}
      {selectedMatchJob && (
        <WhyThisJobModal
          job={selectedMatchJob}
          onClose={() => setSelectedMatchJob(null)}
          onPrepare={(job) => setSelectedPrepareJob(job)}
        />
      )}

      {/* Application Preparation Assistant Modal */}
      {selectedPrepareJob && (
        <ApplicationPrepareModal
          job={selectedPrepareJob}
          onClose={() => setSelectedPrepareJob(null)}
          onMarkApplied={handleMarkApplied}
        />
      )}

      {/* AI Command Palette Modal */}
      <CommandPaletteModal
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onSelectResultJob={(job) => {
          setSelectedMatchJob(job);
          setActiveTab('jobs');
        }}
      />

    </div>
  );
};

export default App;
