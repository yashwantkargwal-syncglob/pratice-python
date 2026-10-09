import React from 'react';
import { Terminal, ShieldCheck, Sparkles, Globe, Download, Cpu, Play } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onQuickRun: () => void;
  onDownloadAll: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onQuickRun,
  onDownloadAll,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Announcement Bar */}
        <div className="py-2.5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
              Draft Mode Enforced (isDraft=True)
            </span>
            <span className="hidden sm:inline text-slate-500">•</span>
            <span className="hidden sm:inline text-slate-400">Strict Tech Niche Filter (US & GB Focus)</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onDownloadAll}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
              title="Download Python automation files"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Download Python Bundle</span>
            </button>
            <button
              onClick={onQuickRun}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Live Simulation</span>
            </button>
          </div>
        </div>

        {/* Main Branding & Navigation */}
        <div className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-xl shadow-lg shadow-sky-950/50 text-white">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white font-mono">
                  Blogger AI Tech Automation
                </h1>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-sky-900/60 text-sky-300 border border-sky-700/50">
                  Python 3.9+
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Autonomous pipeline: <strong className="text-slate-300">Google Trends (US/UK)</strong> → <strong className="text-slate-300">Gemini AI (1500w SEO)</strong> → <strong className="text-slate-300">Blogger API v3 (Drafts)</strong>
              </p>
            </div>
          </div>

          {/* Workflow Pipeline Badges */}
          <div className="hidden lg:flex items-center gap-2 text-xs bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 text-slate-300">
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span>1. Google Trends (US/GB)</span>
            </div>
            <span className="text-slate-600">→</span>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>2. Gemini 1500w + Images</span>
            </div>
            <span className="text-slate-600">→</span>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>3. Blogger Drafts (5/day)</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 border-t border-slate-800/90 pt-1 -mb-px overflow-x-auto">
          {[
            { id: 'studio', label: 'Live Studio & Draft Inspector', icon: Sparkles },
            { id: 'code', label: 'Python Scripts & Export Hub', icon: Terminal },
            { id: 'credentials', label: 'Blogger & API Setup Wizard', icon: Cpu },
            { id: 'scheduler', label: 'Cron & Daemon Generator', icon: Globe },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? 'border-sky-500 text-sky-400 bg-slate-800/40'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
