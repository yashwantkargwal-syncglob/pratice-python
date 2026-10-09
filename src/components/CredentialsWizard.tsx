import React, { useState } from 'react';
import { 
  Key, Shield, ExternalLink, Copy, Check, Download, 
  HelpCircle, CheckCircle2, AlertCircle, FileText 
} from 'lucide-react';

export const CredentialsWizard: React.FC = () => {
  const [bloggerUrlInput, setBloggerUrlInput] = useState<string>('');
  const [detectedBlogId, setDetectedBlogId] = useState<string>('');
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [geoRegions, setGeoRegions] = useState<string>('US,GB');
  const [postsPerRun, setPostsPerRun] = useState<number>(5);
  const [copiedEnv, setCopiedEnv] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // Checkbox steps
  const [stepsCompleted, setStepsCompleted] = useState<Record<string, boolean>>({
    step1: true,
    step2: false,
    step3: false,
    step4: false,
  });

  const toggleStep = (step: string) => {
    setStepsCompleted((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  const handleUrlChange = (url: string) => {
    setBloggerUrlInput(url);
    // Regex to extract numeric Blog ID from Blogger dashboard URL
    // Examples:
    // https://www.blogger.com/blog/posts/8492049182391029384
    // https://www.blogger.com/blog/post/edit/8492049182391029384/5940294123
    const match = url.match(/\/blog\/(?:posts|post\/edit|settings|themes|layout)\/(\d+)/i) || url.match(/^(\d{15,25})$/);
    if (match) {
      setDetectedBlogId(match[1]);
    } else {
      setDetectedBlogId('');
    }
  };

  const [postStatus, setPostStatus] = useState<'DRAFT' | 'LIVE'>('DRAFT');
  const [includeImages, setIncludeImages] = useState<boolean>(true);
  const [imageMode, setImageMode] = useState<'direct' | 'suggestion'>('direct');
  const [enableBacklinks, setEnableBacklinks] = useState<boolean>(true);
  const [maxBacklinks, setMaxBacklinks] = useState<number>(2);
  const [geminiModel, setGeminiModel] = useState<string>('gemini-3.8-flash');

  const generatedEnvContent = `# ==============================================================================
# BLOGGER & GEMINI AUTOMATION ENVIRONMENT CONFIGURATION
# ==============================================================================

# 1. Google Gemini AI API Key (from Google AI Studio: https://aistudio.google.com/app/apikey)
GEMINI_API_KEY="${geminiApiKey || 'your_gemini_api_key_here'}"

# 2. Google Blogger Blog ID (Numeric ID from your Blogger dashboard URL)
BLOGGER_BLOG_ID="${detectedBlogId || 'your_blogger_blog_id_here'}"

# 3. Path to OAuth2 Client Secrets JSON file from Google Cloud Console
# IMPORTANT: Put the filename (e.g. client_secrets.json), NOT your GOCSPX secret key!
GOOGLE_CLIENT_SECRETS_FILE="client_secrets.json"

# 4. Path to persist OAuth tokens (auto-generated after first browser login)
GOOGLE_TOKEN_FILE="token.json"

# 5. Geographies to monitor (US = United States, GB = United Kingdom)
GEO_REGIONS="${geoRegions}"

# 6. Target daily batch post count
POSTS_PER_RUN=${postsPerRun}

# 7. Model choice (Supported: gemini-3.8-flash, gemini-flash-latest, gemini-3.1-flash-lite)
GEMINI_MODEL="${geminiModel}"

# 8. POST STATUS: 'DRAFT' (safe dashboard staging) or 'LIVE' (instant public publishing)
BLOG_POST_STATUS="${postStatus}"

# 9. IMAGES CONFIGURATION
# INCLUDE_IMAGES: true or false
INCLUDE_IMAGES=${includeImages}

# IMAGE_MODE: 'direct' (embeds real high-res AI images) or 'suggestion' (designer cards)
IMAGE_MODE="${imageMode}"

# 10. AUTOMATIC INTERNAL BACKLINKING
# Weaves natural, contextual backlinks to your previously published Blogger posts
ENABLE_INTERNAL_LINKING=${enableBacklinks}
MAX_INTERNAL_BACKLINKS=${maxBacklinks}

# 11. ARTICLE MEMORY & DEDUPLICATION DATABASE
HISTORY_FILE="published_history.json"
`;

  const handleCopyEnv = () => {
    navigator.clipboard.writeText(generatedEnvContent);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2000);
  };

  const handleDownloadEnv = () => {
    const blob = new Blob([generatedEnvContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '.env';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Key className="w-5 h-5 text-sky-400" />
          <span>Blogger API & Credentials Configuration Wizard</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Follow these 3 simple steps to connect your Google Blogger blog and Gemini AI API key. All credentials remain completely private on your local machine or server.
        </p>
      </div>

      {/* Wizard Step 1: Blogger Blog ID Finder */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-950 text-sky-400 text-xs font-mono font-bold border border-sky-800">
            1
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Find Your Blogger Blog ID
            </h3>
            <p className="text-xs text-slate-400">
              Paste your Blogger dashboard URL below and we will automatically parse your numeric ID:
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Blogger URL (e.g. from your browser when visiting Blogger):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={bloggerUrlInput}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://www.blogger.com/blog/posts/8492049182391029384"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
              />
              <button
                onClick={() => handleUrlChange('https://www.blogger.com/blog/posts/8492049182391029384')}
                className="px-3 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              >
                Sample URL
              </button>
            </div>
          </div>

          {detectedBlogId ? (
            <div className="bg-emerald-950/50 border border-emerald-800/80 rounded-lg p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-emerald-300 block">
                    Detected Blogger Blog ID:
                  </span>
                  <span className="font-mono text-sm font-bold text-white">
                    {detectedBlogId}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(detectedBlogId);
                  setCopiedId(true);
                  setTimeout(() => setCopiedId(false), 2000);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 text-xs font-medium transition"
              >
                {copiedId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
              </button>
            </div>
          ) : (
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 text-xs text-slate-400 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                To find it manually: Go to <a href="https://www.blogger.com" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">blogger.com</a>, open your blog, and look at the number after <code>/posts/</code> in the URL.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Wizard Step 2: Google Cloud Console OAuth Setup */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-950 text-sky-400 text-xs font-mono font-bold border border-sky-800">
            2
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Google Cloud Console: Blogger API & OAuth Credentials
            </h3>
            <p className="text-xs text-slate-400">
              Complete these steps in Google Cloud to generate your <code>client_secrets.json</code>:
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            {
              id: 'step1',
              title: 'Enable Blogger API v3 in Google Cloud',
              desc: 'Open Google Cloud Console, select or create a project, search for "Blogger API v3", and click Enable.',
              link: 'https://console.cloud.google.com/apis/library/blogger.googleapis.com',
            },
            {
              id: 'step2',
              title: 'Configure OAuth Consent Screen',
              desc: 'Go to APIs & Services > OAuth consent screen. Select "External". Under Scopes, add: https://www.googleapis.com/auth/blogger',
              link: 'https://console.cloud.google.com/apis/credentials/consent',
            },
            {
              id: 'step3',
              title: 'Add Your Blogger Email to "Test Users"',
              desc: 'Under Test Users, click "+ Add Users" and type the Google account email that owns your Blogger blog.',
              link: 'https://console.cloud.google.com/apis/credentials/consent',
            },
            {
              id: 'step4',
              title: 'Create Desktop OAuth 2.0 Client & Download JSON',
              desc: 'Go to Credentials > Create Credentials > OAuth client ID > Application type: "Desktop app". Click Create, download the JSON, rename it to client_secrets.json, and put it in your script folder.',
              link: 'https://console.cloud.google.com/apis/credentials',
            },
          ].map((step) => {
            const isDone = stepsCompleted[step.id];
            return (
              <div
                key={step.id}
                className={`p-3.5 rounded-lg border transition flex items-start gap-3 ${
                  isDone
                    ? 'bg-slate-950/60 border-slate-800'
                    : 'bg-slate-950 border-slate-800/90'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => toggleStep(step.id)}
                  className="mt-1 w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className={`text-xs font-semibold ${isDone ? 'text-slate-300' : 'text-slate-100'}`}>
                      {step.title}
                    </h4>
                    <a
                      href={step.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300"
                    >
                      <span>Open Console</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-xs text-slate-400">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}

          <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-lg flex items-start gap-2.5 text-xs text-amber-300">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block text-amber-200">Common Mistake to Avoid:</strong>
              When Google Cloud creates your credential, it displays a Client Secret text starting with <code>GOCSPX-...</code>. 
              <strong> Do NOT put this code as the filename in .env!</strong> Instead, click the <strong>Download JSON</strong> icon in the credentials table, save that file as <code>client_secrets.json</code> in your project directory, and reference that file name.
            </div>
          </div>
        </div>
      </div>

      {/* Wizard Step 3: Interactive .env Configurator */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-950 text-sky-400 text-xs font-mono font-bold border border-sky-800">
            3
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Interactive .env File Generator
            </h3>
            <p className="text-xs text-slate-400">
              Fill in your settings below to automatically produce your production <code>.env</code> file:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Gemini API Key:
            </label>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Free key available at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">Google AI Studio</a>.
            </span>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Blogger Blog ID:
            </label>
            <input
              type="text"
              value={detectedBlogId}
              onChange={(e) => setDetectedBlogId(e.target.value)}
              placeholder="8492049182391029384"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Auto-extracted when pasting URL in Step 1.
            </span>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Blogger Publication Status:
            </label>
            <select
              value={postStatus}
              onChange={(e) => setPostStatus(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
            >
              <option value="DRAFT">DRAFT (Safe staging for manual review)</option>
              <option value="LIVE">LIVE (Directly publish to readers immediately)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Gemini AI Model:
            </label>
            <select
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
            >
              <option value="gemini-3.8-flash">gemini-3.8-flash (Recommended active model)</option>
              <option value="gemini-flash-latest">gemini-flash-latest (Reliable high throughput)</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast and ultra-lightweight)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Blog Images Setting:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIncludeImages(true)}
                className={`px-3 py-2 text-xs rounded-lg border font-medium transition ${
                  includeImages
                    ? 'bg-sky-950 border-sky-500 text-sky-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                Include Images
              </button>
              <button
                type="button"
                onClick={() => setIncludeImages(false)}
                className={`px-3 py-2 text-xs rounded-lg border font-medium transition ${
                  !includeImages
                    ? 'bg-rose-950 border-rose-500 text-rose-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                No Images (Text Only)
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Image Mode (if enabled):
            </label>
            <select
              disabled={!includeImages}
              value={imageMode}
              onChange={(e) => setImageMode(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-sky-500 font-mono disabled:opacity-50"
            >
              <option value="direct">Direct Real AI Images (Embedded figure cards)</option>
              <option value="suggestion">Suggestion Cards (Designer callouts for review)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Contextual Internal Backlinking:
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEnableBacklinks(!enableBacklinks)}
                className={`px-3 py-2 text-xs rounded-lg border font-medium transition flex-1 ${
                  enableBacklinks
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                {enableBacklinks ? 'Backlinks: Enabled' : 'Backlinks: Disabled'}
              </button>
              <select
                disabled={!enableBacklinks}
                value={maxBacklinks}
                onChange={(e) => setMaxBacklinks(parseInt(e.target.value) || 2)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono disabled:opacity-50"
              >
                <option value={1}>1 Link</option>
                <option value={2}>2 Links</option>
                <option value={3}>3 Links</option>
                <option value={4}>4 Links</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Monitored Geographies & Batch Count:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={geoRegions}
                onChange={(e) => setGeoRegions(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
              >
                <option value="US,GB">US,GB</option>
                <option value="US">US Only</option>
                <option value="GB">GB Only</option>
              </select>
              <input
                type="number"
                min={1}
                max={15}
                value={postsPerRun}
                onChange={(e) => setPostsPerRun(parseInt(e.target.value) || 5)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                placeholder="5 posts"
              />
            </div>
          </div>
        </div>

        {/* Live .env preview */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-slate-400">
              Generated .env File Content:
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyEnv}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
              >
                {copiedEnv ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedEnv ? 'Copied .env' : 'Copy .env'}</span>
              </button>
              <button
                onClick={handleDownloadEnv}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-950 hover:bg-sky-900 text-sky-300 text-xs font-medium border border-sky-800 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .env</span>
              </button>
            </div>
          </div>

          <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-400 overflow-x-auto">
            {generatedEnvContent}
          </pre>
        </div>
      </div>
    </div>
  );
};
