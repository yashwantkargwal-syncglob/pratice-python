/**
 * @license
 * Apache-2.0
 */

import React, { useState } from 'react';
import { Header } from './components/Header';
import { LiveStudio } from './components/LiveStudio';
import { CodeHub } from './components/CodeHub';
import { CredentialsWizard } from './components/CredentialsWizard';
import { SchedulerGenerator } from './components/SchedulerGenerator';
import { PYTHON_FILES } from './data/pythonFiles';
import { Terminal, ShieldCheck, Sparkles, Download, CheckCircle, Github } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('studio');
  const [downloadNotification, setDownloadNotification] = useState<string | null>(null);

  const handleDownloadAll = () => {
    // Sequentially download the project files
    PYTHON_FILES.forEach((file, index) => {
      setTimeout(() => {
        const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, index * 200);
    });

    setDownloadNotification('Downloading Python automation files package...');
    setTimeout(() => setDownloadNotification(null), 3500);
  };

  const handleQuickRun = () => {
    setActiveTab('studio');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Toast Notification */}
      {downloadNotification && (
        <div className="fixed bottom-6 right-6 z-50 bg-sky-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-medium animate-bounce border border-sky-400">
          <Download className="w-4 h-4" />
          <span>{downloadNotification}</span>
        </div>
      )}

      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onQuickRun={handleQuickRun}
        onDownloadAll={handleDownloadAll}
      />

      {/* Main App Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'studio' && <LiveStudio />}
        {activeTab === 'code' && <CodeHub onDownloadAll={handleDownloadAll} />}
        {activeTab === 'credentials' && <CredentialsWizard />}
        {activeTab === 'scheduler' && <SchedulerGenerator />}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-6 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="font-mono text-slate-300 font-semibold">Blogger AI Tech Automation Engine</span>
            <span>•</span>
            <span>Google Trends (US/UK) + Gemini AI + Blogger API v3</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span className="text-emerald-400 font-mono">isDraft=True Protected</span>
            <span>•</span>
            <span>Python 3.9+ Compatible</span>
            <span>•</span>
            <button
              onClick={handleDownloadAll}
              className="text-sky-400 hover:text-sky-300 underline font-medium"
            >
              Export Scripts
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
