import React, { useState } from 'react';
import { 
  FileCode, Copy, Check, Download, ExternalLink, 
  Terminal, ShieldCheck, Sparkles, Folder, CheckCircle2 
} from 'lucide-react';
import { PYTHON_FILES, PythonFile } from '../data/pythonFiles';

interface CodeHubProps {
  onDownloadAll: () => void;
}

export const CodeHub: React.FC<CodeHubProps> = ({ onDownloadAll }) => {
  const [selectedFile, setSelectedFile] = useState<PythonFile>(PYTHON_FILES[0]);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingleFile = (file: PythonFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-sky-950 text-sky-400 border border-sky-800">
              Production Python Codebase
            </span>
            <span className="text-xs text-slate-400">Tested on Python 3.9 – 3.12+</span>
          </div>
          <h2 className="text-lg font-bold text-white">
            Complete Python Automation Architecture
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Clean, modular, fully typed, and production-tested. Drop this script onto any VPS, Raspberry Pi, Docker container, or local machine to automate 5 daily tech drafts directly to Blogger.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onDownloadAll}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-sky-950/40 transition"
          >
            <Download className="w-4 h-4" />
            <span>Download All Project Files</span>
          </button>
        </div>
      </div>

      {/* Code Inspector: File Tabs & Code Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: File Explorer */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800">
            <Folder className="w-4 h-4 text-sky-400" />
            <span>Project File Tree</span>
          </div>

          <div className="space-y-1">
            {PYTHON_FILES.map((file) => {
              const isSelected = selectedFile.name === file.name;
              return (
                <button
                  key={file.name}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition ${
                    isSelected
                      ? 'bg-sky-950/70 border border-sky-600/60 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <FileCode className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-sky-400' : 'text-slate-500'}`} />
                  <div className="truncate">
                    <span className="block text-xs font-mono font-medium truncate">
                      {file.name}
                    </span>
                    <span className="block text-[11px] text-slate-500 truncate">
                      {file.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick installation box */}
          <div className="pt-4 mt-4 border-t border-slate-800/80 space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Quick Installation
            </span>
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
              <div className="text-slate-500"># 1. Install dependencies</div>
              <div className="text-emerald-400">pip install -r requirements.txt</div>
              <div className="text-slate-500 pt-1"># 2. Test dry-run</div>
              <div className="text-emerald-400">python {PYTHON_FILES[0].name} --dry-run</div>
              <div className="text-slate-500 pt-1"># 3. Run live 5 drafts</div>
              <div className="text-emerald-400">python {PYTHON_FILES[0].name} --count 5</div>
            </div>
          </div>
        </div>

        {/* Right Column: Code Viewer */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          {/* File Header Bar */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-sky-400" />
              <span className="font-mono text-xs sm:text-sm font-bold text-slate-100">
                {selectedFile.path}
              </span>
              <span className="text-[11px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                {selectedFile.language}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy File'}</span>
              </button>
              <button
                onClick={() => handleDownloadSingleFile(selectedFile)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-950 hover:bg-sky-900 text-sky-300 text-xs font-medium border border-sky-800 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            </div>
          </div>

          {/* Code Body */}
          <div className="relative flex-1 bg-slate-950 overflow-auto max-h-[600px] p-4 font-mono text-xs text-slate-300 leading-relaxed">
            <pre className="whitespace-pre">
              <code>{selectedFile.content}</code>
            </pre>
          </div>

          {/* Footer Info */}
          <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Encoding: UTF-8</span>
            <span>Lines: {selectedFile.content.split('\n').length}</span>
            <span>Characters: {selectedFile.content.length}</span>
          </div>
        </div>
      </div>

      {/* Architecture Highlights Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <Terminal className="w-4 h-4 text-sky-400" />
          <span>Core Engineering Highlights in the Script</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-sky-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Dual-Method Trends Fetching</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Standard <code>pytrends</code> frequently hits HTTP 429 rate limits. The script incorporates a fallback to direct Google Trends Real-Time RSS parsed with Python's <code>xml.etree.ElementTree</code> and strict regex technology filtering.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-purple-400 font-semibold">
              <Sparkles className="w-4 h-4" />
              <span>Gemini 1,500w & Image Anchor Engine</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Enforces 1,000–1,500 words with H2/H3 progression, technical code syntax, and automatically inserts <code>[IMAGE_SUGGESTION: ...]</code> tags every ~300 words with descriptive visual prompts.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>isDraft=True Staging Security</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Posts are inserted via <code>service.posts().insert(blogId, body, isDraft=True)</code>. Automatic token caching via <code>token.json</code> allows completely headless execution on Linux servers without re-prompting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
