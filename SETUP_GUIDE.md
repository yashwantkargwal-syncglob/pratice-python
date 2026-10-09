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

# On Windows:
venv\Scripts\activate

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

To allow Python to stage drafts in your Blogger account, configure an OAuth 2.0 Client:

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
6. A dialog appears. Click **Download JSON**.
7. Rename the downloaded file to `client_secrets.json` and move it into your project folder.

---

## 5. Running the Script

### Step 5.1: Dry-Run Test (No Blogger Call)
Test Google Trends research and Gemini article generation without touching Blogger:
```bash
python blogger_trends_automation.py --dry-run --count 1
```
This generates a local HTML preview file (`preview_....html`) that you can open in your browser to inspect the formatting, H2/H3 tags, and `[IMAGE_SUGGESTION: ...]` cards!

### Step 5.2: First Live Run (OAuth Consent)
```bash
python blogger_trends_automation.py --count 5
```
1. On the very first run, a browser tab will automatically open asking you to sign in with your Google account.
2. If you see "Google hasn't verified this app", click **Advanced** -> **Go to Blogger Tech Bot (unsafe)**.
3. Grant access to manage your Blogger account.
4. Once completed, the browser will display *"The authentication flow has completed."*
5. The script automatically saves `token.json` in your directory. Future runs are **100% headless** and will NOT open a browser!

---

## 6. Automating with Cron or Systemd

### Option A: Crontab (Runs daily at 9:00 AM)
Open crontab:
```bash
crontab -e
```
Add this line (adjust paths to your environment):
```cron
0 9 * * * cd /home/ubuntu/blogger_automation && /home/ubuntu/blogger_automation/venv/bin/python blogger_trends_automation.py --count 5 >> /home/ubuntu/blogger_automation/cron.log 2>&1
```

### Option B: Built-in Daemon Mode (Runs every 4 hours)
Run with nohup or tmux:
```bash
nohup python blogger_trends_automation.py --mode daemon --interval-hours 4 > automation.log 2>&1 &
```

---

## 7. Reviewing Your Drafts in Blogger

1. Go to **[Blogger Dashboard](https://www.blogger.com/)**.
2. Navigate to **Posts** -> **Drafts**.
3. You will find your 5 newly staged articles with:
   - Clean titles and tech labels.
   - High-contrast visual placeholders for your images.
   - Ready to review, edit, add images, and publish with one click!
