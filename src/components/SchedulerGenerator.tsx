import React, { useState } from 'react';
import { 
  Clock, Terminal, Copy, Check, Server, Shield, 
  Layers, RefreshCw, Cpu, CheckCircle2 
} from 'lucide-react';

export const SchedulerGenerator: React.FC = () => {
  const [scheduleType, setScheduleType] = useState<'cron' | 'daemon' | 'systemd' | 'docker'>('cron');
  const [frequency, setFrequency] = useState<'daily' | 'twice_daily' | 'every_4_hours' | 'every_hour'>('daily');
  const [pythonPath, setPythonPath] = useState<string>('/home/ubuntu/blogger_automation/venv/bin/python');
  const [projectPath, setProjectPath] = useState<string>('/home/ubuntu/blogger_automation');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Cron expressions based on selection
  let cronTime = '0 9 * * *';
  let descText = 'Runs every day at 09:00 AM server time (Generates 5 distinct drafts).';
  if (frequency === 'twice_daily') {
    cronTime = '0 9,18 * * *';
    descText = 'Runs twice daily at 09:00 AM and 06:00 PM (Generates 5 distinct drafts per run).';
  } else if (frequency === 'every_4_hours') {
    cronTime = '0 */4 * * *';
    descText = 'Runs every 4 hours throughout the day.';
  } else if (frequency === 'every_hour') {
    cronTime = '0 * * * *';
    descText = 'Runs at minute 0 of every hour.';
  }

  const cronCommand = `${cronTime} cd ${projectPath} && ${pythonPath} blogger_trends_automation.py --count 5 >> ${projectPath}/automation.log 2>&1`;

  const daemonCommand = `nohup ${pythonPath} blogger_trends_automation.py --mode daemon --interval-hours 4 > ${projectPath}/daemon.log 2>&1 &`;

  const systemdService = `[Unit]
Description=Blogger AI Tech Automation Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=${projectPath}
ExecStart=${pythonPath} blogger_trends_automation.py --mode daemon --interval-hours 4
Restart=always
RestartSec=60
EnvironmentFile=${projectPath}/.env

[Install]
WantedBy=multi-user.target`;

  const dockerfileContent = `FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends cron curl && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy automation scripts
COPY . .

# Run daemon mode by default (generates 5 drafts every 4 hours)
CMD ["python", "blogger_trends_automation.py", "--mode", "daemon", "--interval-hours", "4"]
`;

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-sky-400" />
          <span>Automation Scheduling & Background Execution Generator</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Configure how and when your Python script runs in the background. Generate production-ready Crontab commands, Linux Systemd daemon services, or Docker containers.
        </p>
      </div>

      {/* Mode Selector Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
          {[
            { id: 'cron', label: '1. Linux Crontab (Recommended)', icon: Clock },
            { id: 'daemon', label: '2. Background Daemon Loop', icon: RefreshCw },
            { id: 'systemd', label: '3. Systemd Service Unit', icon: Server },
            { id: 'docker', label: '4. Docker Container', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = scheduleType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setScheduleType(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Path Customization Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Project Root Path on Server:
            </label>
            <input
              type="text"
              value={projectPath}
              onChange={(e) => {
                setProjectPath(e.target.value);
                setPythonPath(`${e.target.value}/venv/bin/python`);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Python / Virtualenv Binary Path:
            </label>
            <input
              type="text"
              value={pythonPath}
              onChange={(e) => setPythonPath(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* 1. CRONTAB VIEW */}
        {scheduleType === 'cron' && (
          <div className="space-y-4 pt-3 border-t border-slate-800/80">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Select Execution Frequency:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'daily', label: 'Once Daily (9 AM)' },
                  { id: 'twice_daily', label: 'Twice Daily (9 AM & 6 PM)' },
                  { id: 'every_4_hours', label: 'Every 4 Hours' },
                  { id: 'every_hour', label: 'Every Hour' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFrequency(f.id as any)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border text-center transition ${
                      frequency === f.id
                        ? 'bg-sky-950 border-sky-500 text-sky-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500 mt-2 block">{descText}</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">
                  Step 1: Open your Crontab in terminal
                </span>
                <button
                  onClick={() => handleCopy('crontab -e', 'crontab-cmd')}
                  className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                >
                  {copiedKey === 'crontab-cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'crontab-cmd' ? 'Copied' : 'Copy command'}</span>
                </button>
              </div>
              <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono text-emerald-400">
                crontab -e
              </pre>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">
                  Step 2: Paste this exact crontab entry
                </span>
                <button
                  onClick={() => handleCopy(cronCommand, 'cron-entry')}
                  className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                >
                  {copiedKey === 'cron-entry' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'cron-entry' ? 'Copied Crontab' : 'Copy Crontab Entry'}</span>
                </button>
              </div>
              <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-sky-300 overflow-x-auto whitespace-pre-wrap">
                {cronCommand}
              </pre>
            </div>
          </div>
        )}

        {/* 2. DAEMON VIEW */}
        {scheduleType === 'daemon' && (
          <div className="space-y-4 pt-3 border-t border-slate-800/80">
            <p className="text-xs text-slate-300">
              The script contains a built-in while-sleep daemon mode (<code>--mode daemon</code>). You can launch it with <code>nohup</code> to keep it running in the background even if you close your SSH terminal session:
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">
                  Run in background with nohup:
                </span>
                <button
                  onClick={() => handleCopy(daemonCommand, 'daemon-cmd')}
                  className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                >
                  {copiedKey === 'daemon-cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'daemon-cmd' ? 'Copied' : 'Copy Command'}</span>
                </button>
              </div>
              <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                {daemonCommand}
              </pre>
            </div>

            <div className="space-y-2 pt-2">
              <span className="text-xs font-medium text-slate-300 block">
                Monitor real-time progress logs:
              </span>
              <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono text-slate-300">
                tail -f {projectPath}/daemon.log
              </pre>
            </div>
          </div>
        )}

        {/* 3. SYSTEMD SERVICE VIEW */}
        {scheduleType === 'systemd' && (
          <div className="space-y-4 pt-3 border-t border-slate-800/80">
            <p className="text-xs text-slate-300">
              For Ubuntu/Debian/CentOS servers, run as a managed system service with auto-restart on boot:
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">
                  Save to: <code>/etc/systemd/system/blogger-automation.service</code>
                </span>
                <button
                  onClick={() => handleCopy(systemdService, 'systemd-unit')}
                  className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                >
                  {copiedKey === 'systemd-unit' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'systemd-unit' ? 'Copied' : 'Copy Service File'}</span>
                </button>
              </div>
              <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-sky-300 overflow-x-auto">
                {systemdService}
              </pre>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-slate-300 block">
                Enable and start the service:
              </span>
              <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono text-emerald-400">
                sudo systemctl daemon-reload && sudo systemctl enable --now blogger-automation
              </pre>
            </div>
          </div>
        )}

        {/* 4. DOCKER VIEW */}
        {scheduleType === 'docker' && (
          <div className="space-y-4 pt-3 border-t border-slate-800/80">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">
                  Dockerfile:
                </span>
                <button
                  onClick={() => handleCopy(dockerfileContent, 'dockerfile')}
                  className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                >
                  {copiedKey === 'dockerfile' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'dockerfile' ? 'Copied' : 'Copy Dockerfile'}</span>
                </button>
              </div>
              <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-amber-300 overflow-x-auto">
                {dockerfileContent}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
