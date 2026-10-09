# Complete Setup Guide: Blogger + Gemini Tech Automation

This guide walks you through setting up credentials, configuring Google Cloud Console, and running the Python automation script on your local machine, VPS, or cloud server.

---

## 1. Prerequisites & Installation

Make sure you have **Python 3.9+** installed:

```bash
# 1. Create a clean virtual environment
python -m venv venv

# On Linux/macOS:
source venv/bin/activate

# On Windows (PowerShell):
venv\Scripts\Activate.ps1
# Or Command Prompt:
venv\Scripts\activate.bat

# 2. Install dependencies
pip install -r requirements.txt
```

---

## 2. Getting Your Gemini API Key

1. Go to **[Google AI Studio](https://aistudio.google.com/app/apikey)**.
2. Sign in with your Google account.
3. Click **"Create API key"** and select a Google Cloud project (or create a new one).
4. Copy your API key.
5. Add it to your `.env` file:
   ```env
   GEMINI_API_KEY="AIzaSyYourGeminiApiKeyHere..."
   ```

---

## 3. Finding Your Blogger Blog ID

1. Open **[Google Blogger](https://www.blogger.com/)** and select your target blog.
2. Look at the URL in your browser's address bar:
   ```
   https://www.blogger.com/blog/posts/8492049182391029384
   ```
3. The numeric string at the very end (`8492049182391029384`) is your **Blogger Blog ID**.
4. Add it to your `.env` file:
   ```env
   BLOGGER_BLOG_ID="8492049182391029384"
   ```

---

## 4. Google Cloud Console: Blogger API & OAuth Credentials

To allow Python to stage drafts or publish to your Blogger account, configure an OAuth 2.0 Client:

### Step 4.1: Enable Blogger API v3
1. Visit the **[Google Cloud Console](https://console.cloud.google.com/)**.
2. Select or create a project (e.g., `Blogger-Automation`).
3. In the search bar at the top, type **"Blogger API v3"** and press Enter.
4. Click **Enable**.

### Step 4.2: Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Choose **External** (or Internal if using Google Workspace) and click **Create**.
3. Fill in:
   - **App name**: `Blogger Tech Bot`
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Click **Save and Continue**.
5. On the **Scopes** page, click **Add or Remove Scopes**:
   - Filter or manually add: `https://www.googleapis.com/auth/blogger`
   - Click **Save and Continue**.
6. On the **Test users** page:
   - Click **+ Add Users** and type the Google email associated with your Blogger account.
   - Click **Save and Continue**.

### Step 4.3: Create OAuth 2.0 Client ID
1. Navigate to **APIs & Services > Credentials**.
2. Click **+ Create Credentials** at the top and select **OAuth client ID**.
3. Application type: Select **Desktop app**.
4. Name: `Blogger Desktop CLI Client`.
5. Click **Create**.
6. A dialog appears. Click **Download JSON** (or the down arrow icon on the credentials list).
7. Save the downloaded file into your project folder and name it `client_secrets.json`.

> ⚠️ **CRITICAL NOTE**:
> Google Cloud will show you a "Client Secret" text starting with `GOCSPX-...`. 
> **DO NOT** put `GOCSPX-...` in your `.env` as the filename! 
> In `.env`, set:
> ```env
> GOOGLE_CLIENT_SECRETS_FILE="client_secrets.json"
> ```
> The script also includes auto-discovery: if you have any downloaded `client_secret_*.json` in your folder, it will automatically find and use it!

---

## 5. Environment Variables Overview (.env)

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | *(Required)* | Google Gemini AI Key |
| `BLOGGER_BLOG_ID` | *(Required)* | Numeric Blogger ID |
| `GOOGLE_CLIENT_SECRETS_FILE` | `client_secrets.json` | Path to downloaded OAuth client JSON |
| `BLOG_POST_STATUS` | `DRAFT` | `DRAFT` (safe staging for review) or `LIVE` (instant publishing) |
| `INCLUDE_IMAGES` | `true` | `true` (add images/prompts) or `false` (pure text and code only) |
| `IMAGE_MODE` | `direct` | `direct` (real high-res AI images) or `suggestion` (designer cards) |
| `ENABLE_INTERNAL_LINKING` | `true` | Naturally link to previously published posts on your blog |
| `MAX_INTERNAL_BACKLINKS` | `2` | Number of internal backlinks woven per article |
| `HISTORY_FILE` | `published_history.json` | Persistent memory file preventing duplicate topics |
| `POSTS_PER_RUN` | `5` | Batch count of articles per execution |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Active Gemini model (`gemini-3.8-flash` / `gemini-flash-latest`) |

---

## 6. Running the Script

### 6.1 Dry-Run Test (Zero Blogger Calls)
Test trends research and Gemini generation locally:
```bash
python blogger_trends_automation.py --dry-run --count 1
```
Creates a local `preview_....html` file that you can double click and preview in your browser!

### 6.2 Staging Drafts (Default)
Generates 5 articles and saves them as drafts in your Blogger dashboard:
```bash
python blogger_trends_automation.py --count 5
```

### 6.3 Publishing Directly LIVE to Readers
```bash
python blogger_trends_automation.py --count 1 --publish-live
# or:
python blogger_trends_automation.py --status live
```

### 6.4 Controlling Images
```bash
# Text-only (no images or placeholders)
python blogger_trends_automation.py --no-images

# With designer suggestion cards instead of direct images
python blogger_trends_automation.py --image-mode suggestion
```

### 6.5 Inspecting & Managing Memory (Zero Duplicates)
```bash
# View list of all previously covered topics:
python blogger_trends_automation.py --history

# Reset memory to start fresh:
python blogger_trends_automation.py --clear-history
```

---

## 7. First Run: One-Time OAuth Login

1. On the very first live run, a browser tab opens asking you to log into Google.
2. If you see *"Google hasn't verified this app"*, click **Advanced** -> **Go to Blogger Tech Bot (unsafe)**.
3. Grant permission to manage Blogger.
4. Once completed, the browser shows *"The authentication flow has completed."*
5. The script automatically saves `token.json`. **All future runs are 100% headless** and run silently in the background!

---

## 8. Automating in Background (Cron / Daemon)

### Option A: Crontab (Runs daily at 9:00 AM)
```bash
crontab -e
```
Add this line:
```cron
0 9 * * * cd /home/ubuntu/blogger_automation && /home/ubuntu/blogger_automation/venv/bin/python blogger_trends_automation.py --count 5 >> cron.log 2>&1
```

### Option B: Built-in Daemon Mode (Runs every 4 hours)
```bash
nohup python blogger_trends_automation.py --mode daemon --interval-hours 4 > automation.log 2>&1 &
```
