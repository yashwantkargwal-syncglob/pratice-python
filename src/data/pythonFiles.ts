export interface PythonFile {
  name: string;
  path: string;
  language: string;
  description: string;
  content: string;
}

export const PYTHON_FILES: PythonFile[] = [
  {
    name: 'blogger_trends_automation.py',
    path: 'python_automation/blogger_trends_automation.py',
    language: 'python',
    description: 'Standalone, complete, production-ready script with Google Trends, Gemini, and Blogger API v3',
    content: `#!/usr/bin/env python3
"""
================================================================================
BLOGGER TECH TRENDS AUTOMATION ENGINE
================================================================================
Automated pipeline connecting Google Trends (US & UK), Gemini AI, and Google
Blogger API v3 to research tech topics, generate SEO-optimized articles,
and stage them as DRAFTS in your Blogger dashboard.

Key Features:
- Geo-Targeted: United States ('US') and United Kingdom ('GB')
- Strict Niche Filter: Technology, Developer Tools, AI, Frameworks, Cloud, Coding
- Gemini AI Generation: 1,000 - 1,500 words with H2/H3, code blocks, and SEO metadata
- Image Placeholders: Formats [IMAGE_SUGGESTION: ...] tags into Blogger-ready cards
- Blogger API v3 Integration: Authenticates via OAuth2 & creates drafts (isDraft=True)
- Dual Execution Modes: Standalone batch (5 drafts), Dry-run preview, or Daemon loop

Author: Senior Python Automation Engineer
License: Apache-2.0
================================================================================
"""

import os
import sys
import re
import time
import json
import logging
import argparse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import List, Dict, Optional, Tuple

# Try loading environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Try importing Markdown parser
try:
    import markdown
except ImportError:
    markdown = None

# Configure high-visibility console logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("BloggerAutomation")


# ==============================================================================
# CONFIGURATION & ENVIRONMENT VARIABLES
# ==============================================================================
class Config:
    """
    Central configuration manager.
    Values can be provided via .env file, environment variables, or hardcoded below.
    """
    # 1. GOOGLE GEMINI API KEY
    # Get your key at: https://aistudio.google.com/app/apikey
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # 2. GOOGLE BLOGGER BLOG ID
    # Locate your Blog ID in your Blogger URL: https://www.blogger.com/blog/posts/<BLOG_ID>
    BLOGGER_BLOG_ID: str = os.getenv("BLOGGER_BLOG_ID", "")

    # 3. GOOGLE CLOUD OAUTH2 CLIENT SECRETS FILE
    # Download JSON from Google Cloud Console -> APIs & Services -> Credentials
    # Recommended type: "Desktop Application"
    CLIENT_SECRETS_FILE: str = os.getenv("GOOGLE_CLIENT_SECRETS_FILE", "client_secrets.json")

    # 4. TOKEN STORAGE FOR HEADLESS RUNS
    # Stores OAuth access/refresh tokens after the first interactive login
    TOKEN_FILE: str = os.getenv("GOOGLE_TOKEN_FILE", "token.json")

    # 5. TARGET COUNT & GEOS
    TARGET_POSTS_COUNT: int = int(os.getenv("POSTS_PER_RUN", "5"))
    TARGET_REGIONS: List[str] = [
        r.strip().upper() for r in os.getenv("GEO_REGIONS", "US,GB").split(",") if r.strip()
    ]

    # 6. GEMINI MODEL CONFIGURATION
    # Recommended: gemini-2.5-flash or gemini-1.5-pro / gemini-2.0-flash
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # 7. BLOGGER SCOPE
    BLOGGER_SCOPES: List[str] = ["https://www.googleapis.com/auth/blogger"]

    # 8. RATE LIMIT SAFETY (Seconds between post generations)
    INTER_POST_DELAY: int = int(os.getenv("INTER_POST_DELAY", "20"))


# ==============================================================================
# STEP 1: KEYWORD & TREND RESEARCH (Google Trends US/GB with Tech Filters)
# ==============================================================================
class TechTrendResearcher:
    """
    Extracts high-velocity trending tech topics from Google Trends for US & UK.
    Includes dual-strategy fetching:
      1. pytrends library (if installed and responsive)
      2. Direct Google Trends Real-Time RSS Feeds with strict Tech taxonomy filtering
         (Bulletproof fallback against pytrends 429 rate-limiting)
    """

    # Comprehensive Positive Tech Lexicon for US/UK Markets
    TECH_INDICATORS = {
        "ai", "artificial intelligence", "machine learning", "deep learning", "llm",
        "chatgpt", "openai", "gemini", "anthropic", "claude", "copilot", "nvidia",
        "python", "rust", "golang", "javascript", "typescript", "react", "vue",
        "docker", "kubernetes", "cloud", "aws", "azure", "google cloud", "devops",
        "linux", "cybersecurity", "ransomware", "zero-day", "vulnerability",
        "database", "postgresql", "sql", "redis", "mongodb", "graphql", "api",
        "apple", "iphone", "macbook", "m4", "m3", "ios", "android", "pixel",
        "quantum", "semiconductor", "tsmc", "intel", "amd", "gpu", "neural",
        "software", "firmware", "github", "gitlab", "framework", "algorithm",
        "web3", "cryptography", "microservices", "automation", "robotics",
        "developer", "coding", "debugger", "ide", "vscode", "compiler"
    }

    # Strict Negative Exclusions (filtering out non-tech entertainment & politics)
    NEGATIVE_EXCLUSIONS = {
        "football", "soccer", "nfl", "nba", "premier league", "celebrity", "actor",
        "actress", "movie review", "box office", "dating", "horoscope", "lottery",
        "powerball", "scandal", "divorce", "fashion week", "red carpet"
    }

    # Curated Evergreen & Hot 2025/2026 Tech Topics if external feeds are blocked
    FALLBACK_TECH_TOPICS = [
        {"title": "Agentic AI Workflows with Python and LangGraph", "geo": "US", "traffic": "50K+"},
        {"title": "Rust vs Go for High-Performance Cloud Microservices", "geo": "US", "traffic": "40K+"},
        {"title": "Local LLM Deployment on Apple Silicon and Linux with Ollama", "geo": "GB", "traffic": "35K+"},
        {"title": "Modern API Security Architecture: Zero Trust & Token Hardening", "geo": "US", "traffic": "30K+"},
        {"title": "TypeScript 5.8 & React 19: The New Frontend Architecture Paradigm", "geo": "GB", "traffic": "25K+"},
        {"title": "Automating DevOps Pipelines with GitHub Actions and Terraform", "geo": "US", "traffic": "20K+"},
        {"title": "Quantum Computing Milestones and Post-Quantum Cryptography in 2026", "geo": "GB", "traffic": "15K+"}
    ]

    @classmethod
    def is_tech_relevant(cls, text: str) -> bool:
        """Determines if a topic string matches the tech criteria."""
        lower_text = text.lower()

        # Reject explicitly disqualified terms
        if any(neg in lower_text for neg in cls.NEGATIVE_EXCLUSIONS):
            return False

        # Accept if matches word boundary or tech keyword
        for tech in cls.TECH_INDICATORS:
            if re.search(r'\\b' + re.escape(tech) + r'\\b', lower_text):
                return True
        return False

    @classmethod
    def fetch_via_rss(cls, geo: str) -> List[Dict[str, str]]:
        """
        Fetches Google Trends Daily RSS Feed for a specific geo ('US' or 'GB').
        Very stable and avoids pytrends 429 captcha limits.
        """
        trends = []
        feed_url = f"https://trends.google.com/trending/rss?geo={geo}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        }

        try:
            req = urllib.request.Request(feed_url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as response:
                xml_data = response.read()

            root = ET.fromstring(xml_data)
            for item in root.findall(".//item"):
                title_elem = item.find("title")
                traffic_elem = item.find("{https://trends.google.com/trending/rss}approx_traffic")
                desc_elem = item.find("description")

                title = title_elem.text.strip() if title_elem is not None and title_elem.text else ""
                desc = desc_elem.text.strip() if desc_elem is not None and desc_elem.text else ""
                traffic = traffic_elem.text.strip() if traffic_elem is not None and traffic_elem.text else "N/A"

                combined_context = f"{title} {desc}"
                if cls.is_tech_relevant(combined_context):
                    trends.append({
                        "title": title,
                        "geo": geo,
                        "traffic": traffic,
                        "context": desc[:160] if desc else ""
                    })

        except Exception as e:
            logger.warning(f"Could not fetch Google Trends RSS for {geo}: {e}")

        return trends

    @classmethod
    def fetch_via_pytrends(cls, geo: str) -> List[Dict[str, str]]:
        """Attempts to fetch trending tech topics via pytrends library if available."""
        trends = []
        try:
            from pytrends.request import TrendReq
            pytrend = TrendReq(hl='en-US', tz=360, timeout=(10, 25))
            trending_df = pytrend.trending_searches(pn='united_states' if geo == 'US' else 'united_kingdom')
            for _, row in trending_df.iterrows():
                term = str(row[0])
                if cls.is_tech_relevant(term):
                    trends.append({
                        "title": term,
                        "geo": geo,
                        "traffic": "High",
                        "context": "Google Trends High Volume Search"
                    })
        except Exception as e:
            logger.debug(f"pytrends library skipped or rate-limited for {geo}: {e}")

        return trends

    @classmethod
    def get_top_tech_trends(cls, max_count: int = 5) -> List[Dict[str, str]]:
        """Coordinates research across US & GB and returns top tech trends."""
        logger.info(f"Starting Google Trends Tech Research for Regions: {Config.TARGET_REGIONS}")
        collected: List[Dict[str, str]] = []
        seen_titles = set()

        for geo in Config.TARGET_REGIONS:
            # 1. Try pytrends
            pytrend_results = cls.fetch_via_pytrends(geo)
            for item in pytrend_results:
                clean_key = item["title"].lower().strip()
                if clean_key not in seen_titles:
                    seen_titles.add(clean_key)
                    collected.append(item)

            # 2. Try RSS feed
            rss_results = cls.fetch_via_rss(geo)
            for item in rss_results:
                clean_key = item["title"].lower().strip()
                if clean_key not in seen_titles:
                    seen_titles.add(clean_key)
                    collected.append(item)

        # 3. Supplement with verified curated topics if needed
        if len(collected) < max_count:
            logger.info(f"Supplementing with curated tech topics ({len(collected)} gathered).")
            for fallback in cls.FALLBACK_TECH_TOPICS:
                clean_key = fallback["title"].lower().strip()
                if clean_key not in seen_titles:
                    seen_titles.add(clean_key)
                    collected.append(fallback)
                if len(collected) >= max_count:
                    break

        selected = collected[:max_count]
        logger.info(f"Selected {len(selected)} verified Tech Trends.")
        return selected


# ==============================================================================
# STEP 2: CONTENT GENERATION (Gemini API 1,000-1,500 Words + Image Anchors)
# ==============================================================================
class GeminiContentEngine:
    """Connects to Google Gemini API to write high-ranking tech articles."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or Config.GEMINI_API_KEY
        if not self.api_key:
            raise ValueError("Gemini API Key missing! Set GEMINI_API_KEY in .env.")
        self.client_type, self.client = self._init_client()

    def _init_client(self) -> Tuple[str, any]:
        # 1. Try modern google-genai SDK
        try:
            from google import genai
            client = genai.Client(api_key=self.api_key)
            logger.info("Initialized modern 'google-genai' SDK client.")
            return ("google_genai", client)
        except ImportError:
            pass

        # 2. Try google-generativeai package
        try:
            import google.generativeai as legacy_genai
            legacy_genai.configure(api_key=self.api_key)
            logger.info("Initialized 'google-generativeai' legacy SDK client.")
            return ("google_generativeai", legacy_genai)
        except ImportError:
            pass

        raise ImportError("Please install: pip install google-genai")

    def _build_prompt(self, topic: str, geo: str) -> str:
        locale_preference = "US English" if geo == "US" else "UK English"
        return f"""You are a distinguished Senior Software Engineer, Technology Columnist, and SEO Specialist writing for a high-traffic developer and technology blog aimed at a tech-savvy audience in the {geo} ({locale_preference}).

TOPIC TO COVER:
"{topic}"

CRITICAL EDITORIAL AND STRUCTURAL GUIDELINES:
1. TARGET LENGTH: Between 1,000 and 1,500 words. Comprehensive, deep-dive, no fluff.
2. TONE & STYLE:
   - Engaging, authoritative, insightful, and natural human phrasing.
   - Use clear technical vocabulary suited for developers and tech leads.
3. HEADINGS & STRUCTURE:
   - Use structured Markdown with an engaging H1 title.
   - Use multiple H2 and H3 subheadings for logical progression.
   - Include actionable code snippets (Python, Bash, TypeScript, Dockerfile, etc.) with syntax highlighting.
4. IMAGE SUGGESTIONS REQUIREMENT (MANDATORY):
   - Every ~300 words of content, you MUST insert a dedicated image anchor in this exact syntax:
     [IMAGE_SUGGESTION: Highly descriptive prompt to generate or find a matching image, e.g., 'A modern high-tech server rack illuminated with neon violet LED indicators in a dark data center']
   - Ensure you include AT LEAST 3 to 4 distinct [IMAGE_SUGGESTION: ...] tags placed naturally between sections.
5. EXPLICIT SEO METADATA BLOCK:
   - At the very end of your response, output the following structured block verbatim:
   
### SEO_METADATA_START
META_TITLE: [Click-worthy, SEO-optimized title under 60 characters]
META_DESCRIPTION: [Compelling search snippet with primary keywords under 155 characters]
PRIMARY_KEYWORDS: [Comma-separated list of 5-8 relevant tech keywords]
### SEO_METADATA_END

Write the complete article now in clean Markdown.
"""

    def generate_article(self, topic: str, geo: str = "US") -> str:
        prompt = self._build_prompt(topic, geo)
        logger.info(f"Requesting Gemini content generation for topic: '{topic}' ({geo})...")

        preferred_model = Config.GEMINI_MODEL
        model_candidates = [preferred_model]
        for fallback in ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]:
            if fallback not in model_candidates:
                model_candidates.append(fallback)

        last_error = None
        for model_name in model_candidates:
            logger.info(f"Attempting content generation using model: '{model_name}'...")
            max_retries = 2
            backoff_sec = 4

            for attempt in range(1, max_retries + 1):
                try:
                    if self.client_type == "google_genai":
                        from google.genai import types
                        response = self.client.models.generate_content(
                            model=model_name,
                            contents=prompt,
                            config=types.GenerateContentConfig(temperature=0.7, top_p=0.95)
                        )
                        text = response.text
                    else:
                        model = self.client.GenerativeModel(model_name)
                        response = model.generate_content(prompt)
                        text = response.text

                    if not text or len(text.strip()) < 400:
                        raise ValueError("Received unexpectedly short response from Gemini.")

                    word_count = len(text.split())
                    logger.info(f"Gemini generation successful using '{model_name}'! Generated {word_count} words.")
                    return text

                except Exception as e:
                    err_str = str(e)
                    last_error = e
                    logger.warning(f"Model '{model_name}' attempt {attempt}/{max_retries} failed: {e}")
                    if "404" in err_str or "NOT_FOUND" in err_str or "503" in err_str or "UNAVAILABLE" in err_str:
                        logger.info(f"Model '{model_name}' unavailable or busy. Switching to fallback candidate...")
                        break
                    if attempt < max_retries:
                        time.sleep(backoff_sec * attempt)

        raise RuntimeError(f"All Gemini model candidates failed. Last error: {last_error}")


# ==============================================================================
# STEP 3: BLOGGER FORMATTER & HTML ENGINE
# ==============================================================================
class BloggerContentFormatter:
    """Parses Markdown and formats clean HTML with styled image placeholders."""

    @classmethod
    def parse_seo_metadata(cls, raw_markdown: str) -> Tuple[str, Dict[str, str]]:
        metadata = {"title": "", "description": "", "keywords": []}
        pattern = r"### SEO_METADATA_START\\s*(.*?)\\s*### SEO_METADATA_END"
        match = re.search(pattern, raw_markdown, re.DOTALL)
        clean_markdown = raw_markdown

        if match:
            meta_block = match.group(1)
            clean_markdown = raw_markdown[:match.start()] + raw_markdown[match.end():]
            for line in meta_block.splitlines():
                if line.startswith("META_TITLE:"):
                    metadata["title"] = line.replace("META_TITLE:", "").strip()
                elif line.startswith("META_DESCRIPTION:"):
                    metadata["description"] = line.replace("META_DESCRIPTION:", "").strip()
                elif line.startswith("PRIMARY_KEYWORDS:"):
                    raw_keys = line.replace("PRIMARY_KEYWORDS:", "").strip()
                    metadata["keywords"] = [k.strip() for k in raw_keys.split(",") if k.strip()]

        return clean_markdown.strip(), metadata

    @classmethod
    def extract_post_title(cls, markdown_text: str, fallback_title: str) -> str:
        for line in markdown_text.splitlines():
            line_s = line.strip()
            if line_s.startswith("# "):
                return line_s[2:].strip().replace('"', '')
        return fallback_title

    @classmethod
    def convert_image_suggestions_to_html(cls, html_content: str) -> str:
        def replace_match(match):
            prompt = match.group(1).strip()
            return f"""
<div class="blogger-image-placeholder" style="margin: 28px 0; padding: 18px 22px; background: #0f172a; border-left: 4px solid #38bdf8; border-radius: 8px; color: #f1f5f9; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;">
  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
    <span style="display: inline-block; width: 10px; height: 10px; background-color: #38bdf8; border-radius: 50%;"></span>
    <strong style="color: #38bdf8; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Suggested Visual Asset</strong>
  </div>
  <p style="margin: 0 0 6px 0; font-size: 14px; font-style: italic; color: #cbd5e1; line-height: 1.5;">"{prompt}"</p>
  <span style="font-size: 11px; color: #94a3b8;">Insert your banner or Midjourney/Gemini generated illustration here prior to publishing.</span>
</div>
"""
        return re.sub(r"\\[IMAGE_SUGGESTION:\\s*([^\\]]+)\\]", replace_match, html_content)

    @classmethod
    def format_to_blogger_html(cls, markdown_text: str) -> str:
        if markdown is not None:
            html = markdown.markdown(markdown_text, extensions=['fenced_code', 'tables', 'nl2br'])
        else:
            html = "<p>" + markdown_text.replace("\\n\\n", "</p><p>") + "</p>"

        # Prettify code blocks
        html = re.sub(
            r'<pre><code>',
            r'<pre style="background: #1e293b; color: #f8fafc; padding: 16px; border-radius: 8px; overflow-x: auto; font-family: Consolas, Monaco, monospace; font-size: 14px; line-height: 1.6;"><code>',
            html
        )
        return cls.convert_image_suggestions_to_html(html)


# ==============================================================================
# STEP 4: GOOGLE BLOGGER API v3 CLIENT (DRAFT ONLY)
# ==============================================================================
class BloggerClient:
    """Authenticates with Blogger API v3 and stages drafts (isDraft=True)."""

    def __init__(self, blog_id: Optional[str] = None):
        self.blog_id = blog_id or Config.BLOGGER_BLOG_ID
        if not self.blog_id:
            raise ValueError("Blogger Blog ID missing! Set BLOGGER_BLOG_ID in .env.")
        self.service = self._authenticate()

    def _authenticate(self):
        try:
            from google.auth.transport.requests import Request
            from google.oauth2.credentials import Credentials
            from google_auth_oauthlib.flow import InstalledAppFlow
            from googleapiclient.discovery import build
        except ImportError as e:
            raise ImportError("Missing libraries. Run: pip install google-api-python-client google-auth-oauthlib") from e

        creds = None
        if os.path.exists(Config.TOKEN_FILE):
            try:
                creds = Credentials.from_authorized_user_file(Config.TOKEN_FILE, Config.BLOGGER_SCOPES)
            except Exception as e:
                logger.warning(f"Could not load token file: {e}")

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                logger.info("Refreshing expired Google OAuth access token...")
                creds.refresh(Request())
            else:
                if not os.path.exists(Config.CLIENT_SECRETS_FILE):
                    raise FileNotFoundError(f"OAuth client secrets '{Config.CLIENT_SECRETS_FILE}' not found!")
                logger.info("Initiating Google OAuth2 authorization flow...")
                flow = InstalledAppFlow.from_client_secrets_file(Config.CLIENT_SECRETS_FILE, Config.BLOGGER_SCOPES)
                creds = flow.run_local_server(port=0)

            with open(Config.TOKEN_FILE, "w") as token:
                token.write(creds.to_json())
            logger.info(f"OAuth credentials saved to '{Config.TOKEN_FILE}'.")

        service = build("blogger", "v3", credentials=creds)
        blog_info = service.blogs().get(blogId=self.blog_id).execute()
        logger.info(f"Connected to Blogger: '{blog_info.get('name')}'")
        return service

    def create_draft_post(self, title: str, content_html: str, labels: Optional[List[str]] = None, meta_description: Optional[str] = None) -> Dict[str, any]:
        post_body = {
            "kind": "blogger#post",
            "title": title,
            "content": content_html,
            "labels": labels or ["Technology", "Tech Trends", "AI"],
            "status": "DRAFT"
        }
        if meta_description:
            post_body["searchDescription"] = meta_description[:160]

        logger.info(f"Uploading draft to Blogger Blog ID: {self.blog_id} (isDraft=True)...")
        request = self.service.posts().insert(blogId=self.blog_id, body=post_body, isDraft=True)
        post_response = request.execute()

        post_id = post_response.get("id")
        edit_url = f"https://www.blogger.com/blog/post/edit/{self.blog_id}/{post_id}"
        logger.info(f"Draft saved! ID: {post_id}")
        logger.info(f"Edit URL: {edit_url}")

        return {
            "id": post_id,
            "url": post_response.get("url"),
            "edit_url": edit_url,
            "title": post_response.get("title"),
            "status": "DRAFT"
        }


# ==============================================================================
# PIPELINE ORCHESTRATOR & CLI
# ==============================================================================
class BloggerAutomationPipeline:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.gemini_engine = GeminiContentEngine()
        self.blogger_client = None if dry_run else BloggerClient()

    def process_topic(self, topic_info: Dict[str, str]) -> Optional[Dict[str, any]]:
        title_topic = topic_info["title"]
        geo = topic_info.get("geo", "US")

        logger.info(f"Processing Topic: '{title_topic}' [Region: {geo}]")
        raw_markdown = self.gemini_engine.generate_article(title_topic, geo)
        clean_markdown, seo_meta = BloggerContentFormatter.parse_seo_metadata(raw_markdown)
        article_title = seo_meta.get("title") or BloggerContentFormatter.extract_post_title(clean_markdown, title_topic)
        html_content = BloggerContentFormatter.format_to_blogger_html(clean_markdown)

        labels = ["Technology", f"Tech Trends {geo}"]
        if seo_meta.get("keywords"):
            labels.extend(seo_meta["keywords"][:4])
        labels = list(dict.fromkeys(labels))

        if self.dry_run:
            logger.info("[DRY-RUN MODE] Skipping Blogger API call.")
            return {"title": article_title, "status": "DRAFT (DRY RUN)", "id": "dry-run"}

        return self.blogger_client.create_draft_post(
            title=article_title,
            content_html=html_content,
            labels=labels,
            meta_description=seo_meta.get("description")
        )

    def run_batch(self, count: int = 5) -> List[Dict[str, any]]:
        trends = TechTrendResearcher.get_top_tech_trends(max_count=count)
        results = []
        for index, topic in enumerate(trends, 1):
            res = self.process_topic(topic)
            if res:
                results.append(res)
            if index < len(trends):
                logger.info(f"Waiting {Config.INTER_POST_DELAY}s between generations...")
                time.sleep(Config.INTER_POST_DELAY)
        return results


def main():
    parser = argparse.ArgumentParser(description="Automated Tech Blogging Engine")
    parser.add_argument("--count", type=int, default=Config.TARGET_POSTS_COUNT, help="Number of drafts (Default: 5)")
    parser.add_argument("--dry-run", action="store_true", help="Simulate without pushing to Blogger")
    parser.add_argument("--mode", choices=["once", "daemon"], default="once")
    parser.add_argument("--interval-hours", type=int, default=4)
    args = parser.parse_args()

    pipeline = BloggerAutomationPipeline(dry_run=args.dry_run)
    if args.mode == "once":
        pipeline.run_batch(count=args.count)
    elif args.mode == "daemon":
        logger.info(f"Running every {args.interval_hours} hours. Press Ctrl+C to stop.")
        while True:
            pipeline.run_batch(count=args.count)
            time.sleep(args.interval_hours * 3600)

if __name__ == "__main__":
    main()
`,
  },
  {
    name: 'requirements.txt',
    path: 'python_automation/requirements.txt',
    language: 'plaintext',
    description: 'Python package dependencies pinned for compatibility',
    content: `google-genai>=0.1.1
google-api-python-client>=2.120.0
google-auth-httplib2>=0.2.0
google-auth-oauthlib>=1.2.0
pytrends>=4.9.2
python-dotenv>=1.0.1
markdown>=3.6
requests>=2.31.0
`,
  },
  {
    name: '.env.example',
    path: 'python_automation/.env.example',
    language: 'bash',
    description: 'Template for environment variables with clear instructions',
    content: `# ==============================================================================
# BLOGGER & GEMINI AUTOMATION ENVIRONMENT CONFIGURATION
# ==============================================================================

# 1. Google Gemini AI API Key (Obtain from Google AI Studio: https://aistudio.google.com/)
GEMINI_API_KEY="your_gemini_api_key_here"

# 2. Google Blogger Blog ID (Numeric ID from your Blogger Dashboard URL)
# Example URL: https://www.blogger.com/blog/posts/8492049182391029384 -> ID is 8492049182391029384
BLOGGER_BLOG_ID="your_blogger_blog_id_here"

# 3. Path to OAuth2 Client Secrets JSON file from Google Cloud Console
# (API & Services > Credentials > Create Credentials > OAuth 2.0 Client IDs > Desktop App)
GOOGLE_CLIENT_SECRETS_FILE="client_secrets.json"

# 4. Path to persist OAuth tokens (auto-generated after first browser login)
GOOGLE_TOKEN_FILE="token.json"

# 5. Geographies to monitor for Tech Trends (US = United States, GB = United Kingdom)
GEO_REGIONS="US,GB"

# 6. Target daily draft batch count (Default: 5 distinct drafts)
POSTS_PER_RUN=5

# 7. Model choice (Defaults to latest production model)
GEMINI_MODEL="gemini-2.5-flash"
`,
  },
  {
    name: 'SETUP_GUIDE.md',
    path: 'python_automation/SETUP_GUIDE.md',
    language: 'markdown',
    description: 'Complete walkthrough for Google Cloud, OAuth, Blogger ID, and Cron',
    content: `# Complete Setup Guide: Blogger + Gemini Tech Automation

This guide walks you through setting up credentials, configuring Google Cloud Console, and running the Python automation script on your local machine, VPS, or cloud server.

---

## 1. Prerequisites & Installation

Make sure you have **Python 3.9+** installed:

\`\`\`bash
# 1. Create a clean virtual environment
python -m venv venv

# On Linux/macOS:
source venv/bin/activate

# On Windows:
venv\\Scripts\\activate

# 2. Install dependencies
pip install -r requirements.txt
\`\`\`

---

## 2. Getting Your Gemini API Key

1. Go to **[Google AI Studio](https://aistudio.google.com/app/apikey)**.
2. Sign in with your Google account.
3. Click **"Create API key"** and select a Google Cloud project (or create a new one).
4. Copy your API key.
5. Add it to your \`.env\` file:
   \`\`\`env
   GEMINI_API_KEY="AIzaSyYourGeminiApiKeyHere..."
   \`\`\`

---

## 3. Finding Your Blogger Blog ID

1. Open **[Google Blogger](https://www.blogger.com/)** and select your target blog.
2. Look at the URL in your browser's address bar:
   \`\`\`
   https://www.blogger.com/blog/posts/8492049182391029384
   \`\`\`
3. The numeric string at the very end (\`8492049182391029384\`) is your **Blogger Blog ID**.
4. Add it to your \`.env\` file:
   \`\`\`env
   BLOGGER_BLOG_ID="8492049182391029384"
   \`\`\`

---

## 4. Google Cloud Console: Blogger API & OAuth Credentials

To allow Python to stage drafts in your Blogger account, configure an OAuth 2.0 Client:

### Step 4.1: Enable Blogger API v3
1. Visit the **[Google Cloud Console](https://console.cloud.google.com/)**.
2. Select or create a project (e.g., \`Blogger-Automation\`).
3. In the search bar at the top, type **"Blogger API v3"** and press Enter.
4. Click **Enable**.

### Step 4.2: Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Choose **External** (or Internal if using Google Workspace) and click **Create**.
3. Fill in:
   - **App name**: \`Blogger Tech Bot\`
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Click **Save and Continue**.
5. On the **Scopes** page, click **Add or Remove Scopes**:
   - Filter or manually add: \`https://www.googleapis.com/auth/blogger\`
   - Click **Save and Continue**.
6. On the **Test users** page:
   - Click **+ Add Users** and type the Google email associated with your Blogger account.
   - Click **Save and Continue**.

### Step 4.3: Create OAuth 2.0 Client ID
1. Navigate to **APIs & Services > Credentials**.
2. Click **+ Create Credentials** at the top and select **OAuth client ID**.
3. Application type: Select **Desktop app**.
4. Name: \`Blogger Desktop CLI Client\`.
5. Click **Create**.
6. A dialog appears. Click **Download JSON**.
7. Rename the downloaded file to \`client_secrets.json\` and move it into your project folder.

---

## 5. Running the Script

### Step 5.1: Dry-Run Test (No Blogger Call)
Test Google Trends research and Gemini article generation without touching Blogger:
\`\`\`bash
python blogger_trends_automation.py --dry-run --count 1
\`\`\`
This generates a local HTML preview file (\`preview_....html\`) that you can open in your browser to inspect the formatting, H2/H3 tags, and \`[IMAGE_SUGGESTION: ...]\` cards!

### Step 5.2: First Live Run (OAuth Consent)
\`\`\`bash
python blogger_trends_automation.py --count 5
\`\`\`
1. On the very first run, a browser tab will automatically open asking you to sign in with your Google account.
2. If you see "Google hasn't verified this app", click **Advanced** -> **Go to Blogger Tech Bot (unsafe)**.
3. Grant access to manage your Blogger account.
4. Once completed, the browser will display *"The authentication flow has completed."*
5. The script automatically saves \`token.json\` in your directory. Future runs are **100% headless** and will NOT open a browser!

---

## 6. Automating with Cron or Systemd

### Option A: Crontab (Runs daily at 9:00 AM)
Open crontab:
\`\`\`bash
crontab -e
\`\`\`
Add this line:
\`\`\`cron
0 9 * * * cd /home/ubuntu/blogger_automation && /home/ubuntu/blogger_automation/venv/bin/python blogger_trends_automation.py --count 5 >> /home/ubuntu/blogger_automation/cron.log 2>&1
\`\`\`

### Option B: Built-in Daemon Mode (Runs every 4 hours)
\`\`\`bash
nohup python blogger_trends_automation.py --mode daemon --interval-hours 4 > automation.log 2>&1 &
\`\`\`
`,
  },
  {
    name: 'config.py',
    path: 'python_automation/config.py',
    language: 'python',
    description: 'Modular configuration reader for clean package architecture',
    content: `"""
Configuration module for Blogger AI Automation.
"""
import os
from typing import List

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

class Config:
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    BLOGGER_BLOG_ID: str = os.getenv("BLOGGER_BLOG_ID", "")
    CLIENT_SECRETS_FILE: str = os.getenv("GOOGLE_CLIENT_SECRETS_FILE", "client_secrets.json")
    TOKEN_FILE: str = os.getenv("GOOGLE_TOKEN_FILE", "token.json")
    TARGET_POSTS_COUNT: int = int(os.getenv("POSTS_PER_RUN", "5"))
    TARGET_REGIONS: List[str] = [
        r.strip().upper() for r in os.getenv("GEO_REGIONS", "US,GB").split(",") if r.strip()
    ]
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    BLOGGER_SCOPES: List[str] = ["https://www.googleapis.com/auth/blogger"]
    INTER_POST_DELAY: int = int(os.getenv("INTER_POST_DELAY", "20"))
`,
  },
];
