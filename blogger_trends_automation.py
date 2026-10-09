#!/usr/bin/env python3
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
import urllib.parse
import html
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
    # Active supported models: gemini-3.8-flash, gemini-flash-latest, gemini-3.1-flash-lite
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

    # 7. BLOGGER SCOPE
    BLOGGER_SCOPES: List[str] = ["https://www.googleapis.com/auth/blogger"]

    # 8. RATE LIMIT SAFETY (Seconds between post generations)
    INTER_POST_DELAY: int = int(os.getenv("INTER_POST_DELAY", "20"))

    # 9. ARTICLE MEMORY & DEDUPLICATION DATABASE
    # Persistent JSON tracking all generated topics to guarantee 0 duplicates
    HISTORY_FILE: str = os.getenv("HISTORY_FILE", "published_history.json")

    # 10. REAL IMAGE GENERATION & EMBEDDING
    # Automatically generates & embeds real AI tech illustrations into Blogger drafts
    EMBED_REAL_IMAGES: bool = os.getenv("EMBED_REAL_IMAGES", "true").lower() in ("true", "1", "yes")


# ==============================================================================
# MEMORY & DEDUPLICATION ENGINE
# ==============================================================================
class HistoryManager:
    """
    Manages persistent memory of all generated and staged blog posts.
    Stores history in a local JSON database (published_history.json).
    Guarantees that previously covered topics or near-identical titles
    are NEVER re-generated.
    """

    @classmethod
    def _normalize(cls, text: str) -> str:
        """Strips punctuation, lowercases, and removes extra spaces."""
        clean = re.sub(r'[^a-zA-Z0-9\s]', '', text.lower())
        return ' '.join(clean.split())

    @classmethod
    def load_history(cls) -> Dict[str, any]:
        """Loads article history from disk."""
        if not os.path.exists(Config.HISTORY_FILE):
            return {"articles": []}
        try:
            with open(Config.HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Could not read history file '{Config.HISTORY_FILE}': {e}. Using empty memory.")
            return {"articles": []}

    @classmethod
    def is_already_covered(cls, topic: str) -> Tuple[bool, Optional[str]]:
        """
        Checks if a topic has already been generated.
        Uses exact normalized match as well as token overlap similarity
        to prevent near-duplicate topics (e.g. 'Agentic AI in Python' vs 'Agentic AI with Python').
        """
        history = cls.load_history()
        norm_topic = cls._normalize(topic)
        topic_words = set(norm_topic.split())

        for entry in history.get("articles", []):
            existing_norm = entry.get("normalized_topic", "")
            if not existing_norm:
                existing_norm = cls._normalize(entry.get("topic", ""))

            # 1. Exact normalized match
            if norm_topic == existing_norm:
                return True, entry.get("date", "Previously")

            # 2. Token overlap similarity match (Jaccard similarity >= 70%)
            existing_words = set(existing_norm.split())
            if topic_words and existing_words:
                intersection = topic_words.intersection(existing_words)
                union = topic_words.union(existing_words)
                similarity = len(intersection) / len(union) if union else 0
                if similarity >= 0.70:
                    return True, f"{entry.get('date', 'Previously')} (Similar to: '{entry.get('topic')}')"

        return False, None

    @classmethod
    def record_entry(cls, topic: str, title: str, geo: str, post_id: str, is_draft: bool = True):
        """Records a successfully generated/staged article into persistent history."""
        history = cls.load_history()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        entry = {
            "topic": topic,
            "normalized_topic": cls._normalize(topic),
            "title": title,
            "geo": geo,
            "post_id": post_id,
            "is_draft": is_draft,
            "date": now_str,
            "timestamp": int(time.time())
        }

        history.setdefault("articles", []).append(entry)

        try:
            with open(Config.HISTORY_FILE, "w", encoding="utf-8") as f:
                json.dump(history, f, indent=2, ensure_ascii=False)
            logger.info(f"💾 Saved '{topic}' to memory ({Config.HISTORY_FILE}). Total distinct posts: {len(history['articles'])}")
        except Exception as e:
            logger.error(f"Failed to save history to '{Config.HISTORY_FILE}': {e}")

    @classmethod
    def print_history_summary(cls):
        """Prints a clean summary of previously generated drafts."""
        history = cls.load_history()
        articles = history.get("articles", [])
        print("\n" + "=" * 70)
        print(f"BLOGGER AUTOMATION MEMORY DATABASE ({Config.HISTORY_FILE})")
        print(f"Total Unique Posts Stored: {len(articles)}")
        print("=" * 70)
        if not articles:
            print("No articles recorded yet. Memory is empty.")
        else:
            for idx, a in enumerate(articles, 1):
                print(f"{idx}. [{a.get('date', 'N/A')}] [{a.get('geo', 'US')}] {a.get('title')}")
                print(f"   Original Topic: '{a.get('topic')}' | Blogger ID: {a.get('post_id')}")
        print("=" * 70 + "\n")

    @classmethod
    def clear_history(cls):
        """Resets the history file."""
        if os.path.exists(Config.HISTORY_FILE):
            os.remove(Config.HISTORY_FILE)
            logger.info(f"Memory cleared. '{Config.HISTORY_FILE}' has been removed.")
        else:
            logger.info("Memory was already empty.")


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
        {"title": "Model Context Protocol (MCP): The New Standard for AI Tool Use", "geo": "US", "traffic": "45K+"},
        {"title": "Building Production RAG with Vector Databases and Hybrid Search", "geo": "GB", "traffic": "38K+"},
        {"title": "eBPF in Linux and Kubernetes: High-Speed Observability & Security", "geo": "US", "traffic": "28K+"},
        {"title": "Event-Driven Microservices: Kafka vs RabbitMQ in Modern Cloud", "geo": "GB", "traffic": "26K+"},
        {"title": "Docker Multi-Stage Builds and Distroless Images for Python", "geo": "US", "traffic": "22K+"},
        {"title": "WebAssembly on the Server: Replacing Containers in Edge Runtimes", "geo": "GB", "traffic": "19K+"},
        {"title": "PostgreSQL 17 Performance Tuning: Indexing and Connection Pooling", "geo": "GB", "traffic": "24K+"},
        {"title": "Async Python Mastery: Asyncio, AnyIO, and Structured Concurrency", "geo": "US", "traffic": "32K+"},
        {"title": "Quantum Computing Milestones and Post-Quantum Cryptography in 2026", "geo": "GB", "traffic": "15K+"},
        {"title": "Fine-Tuning Small Language Models with LoRA and QLoRA", "geo": "US", "traffic": "42K+"},
        {"title": "GraphQL vs REST vs gRPC: How Modern Engineering Teams Choose APIs", "geo": "GB", "traffic": "21K+"},
        {"title": "Infrastructure as Code: Pulumi vs Terraform for Cloud Teams", "geo": "US", "traffic": "18K+"},
        {"title": "Next-Gen CSS and Tailwind CSS v4: Architecture Guide", "geo": "GB", "traffic": "17K+"},
        {"title": "Cybersecurity in the AI Era: Prompt Injections and LLM Red-Teaming", "geo": "US", "traffic": "39K+"}
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
            if re.search(r'\b' + re.escape(tech) + r'\b', lower_text):
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
            # Standard RSS channel -> items
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
            
            # Category 13 is "Computers & Electronics" in Google Trends taxonomy
            # Try trending searches or real-time trends
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
        """
        Coordinates research across US & GB, applies tech filters, deduplicates,
        and returns exactly `max_count` top tech trends.
        """
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

            # 2. Try RSS feed (Reliable Realtime Feed)
            rss_results = cls.fetch_via_rss(geo)
            for item in rss_results:
                clean_key = item["title"].lower().strip()
                if clean_key not in seen_titles:
                    seen_titles.add(clean_key)
                    collected.append(item)

        # 3. Always add curated tech topics to available pool to ensure deep selection
        for fallback in cls.FALLBACK_TECH_TOPICS:
            clean_key = fallback["title"].lower().strip()
            if clean_key not in seen_titles:
                seen_titles.add(clean_key)
                collected.append(fallback)

        # 4. Filter against persistent HistoryManager to eliminate duplicates
        selected: List[Dict[str, str]] = []
        for item in collected:
            already_covered, reason = HistoryManager.is_already_covered(item["title"])
            if already_covered:
                logger.info(f"⏭️  [Deduplication] Skipping '{item['title']}' (Already generated: {reason})")
                continue
            selected.append(item)
            if len(selected) >= max_count:
                break

        if len(selected) < max_count:
            logger.warning(
                f"Memory database already contains most trending topics. "
                f"Selected {len(selected)}/{max_count} fresh topics. Add more topics or clear history if needed."
            )

        logger.info(f"Successfully selected {len(selected)} FRESH, non-duplicate Tech Trends:")
        for idx, item in enumerate(selected, 1):
            logger.info(f"  {idx}. [{item['geo']}] {item['title']} (Est. Volume: {item.get('traffic', 'N/A')})")

        return selected


# ==============================================================================
# STEP 2: CONTENT GENERATION (Gemini API 1,000-1,500 Words + Image Placeholders)
# ==============================================================================
class GeminiContentEngine:
    """
    Connects to Google Gemini API (using the new `google-genai` SDK or fallback)
    to write deep, authoritative, SEO-rich articles with image anchors and metadata.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or Config.GEMINI_API_KEY
        if not self.api_key:
            raise ValueError(
                "Gemini API Key is missing! Set GEMINI_API_KEY in your .env or environment variables."
            )
        self.client_type, self.client = self._init_client()

    def _init_client(self) -> Tuple[str, any]:
        """Initializes the modern google-genai SDK or google-generativeai fallback."""
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

        raise ImportError(
            "Neither 'google-genai' nor 'google-generativeai' is installed! "
            "Please run: pip install google-genai"
        )

    def _build_prompt(self, topic: str, geo: str) -> str:
        """
        Builds the precision prompt enforcing 1,000-1,500 words, H2/H3 headers,
        code blocks, image suggestion tags every 300 words, and SEO metadata.
        """
        locale_preference = "US English" if geo == "US" else "UK English"
        
        return f"""You are a distinguished Senior Software Engineer, Technology Columnist, and SEO Specialist writing for a high-traffic developer and technology blog aimed at a tech-savvy audience in the {geo} ({locale_preference}).

TOPIC TO COVER:
"{topic}"

CRITICAL EDITORIAL AND STRUCTURAL GUIDELINES:
1. TARGET LENGTH: Between 1,000 and 1,500 words. Comprehensive, deep-dive, no fluff.
2. TONE & STYLE:
   - Engaging, authoritative, insightful, and natural human phrasing (avoid generic clichés like "in this fast-paced digital world").
   - Use clear technical vocabulary suited for developers, architects, tech leads, and tech enthusiasts.
3. HEADINGS & STRUCTURE:
   - Use structured Markdown with an engaging H1 title.
   - Use multiple H2 and H3 subheadings for logical progression (e.g., The Architectural Shift, Technical Deep-Dive, Real-World Implementations, Performance Benchmarks, Future Outlook).
   - Include actionable code snippets (e.g., Python, Bash, TypeScript, Dockerfile, or configuration files) with markdown syntax highlighting if relevant to tools, programming, or architectures.
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
        """Calls Gemini API with automatic model fallback to generate the full article."""
        prompt = self._build_prompt(topic, geo)
        logger.info(f"Requesting Gemini content generation for topic: '{topic}' ({geo})...")

        # Active supported models in cascade order
        preferred_model = Config.GEMINI_MODEL or "gemini-3.8-flash"
        model_candidates = [preferred_model]
        for fallback in ["gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-3.8-flash"]:
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
                            config=types.GenerateContentConfig(
                                temperature=0.7,
                                top_p=0.95,
                            )
                        )
                        text = response.text
                    else:
                        # Legacy SDK fallback
                        model = self.client.GenerativeModel(model_name)
                        response = model.generate_content(prompt)
                        text = response.text

                    if not text or len(text.strip()) < 400:
                        raise ValueError("Received unexpectedly short or empty response from Gemini.")

                    word_count = len(text.split())
                    logger.info(f"Gemini generation successful using '{model_name}'! Generated {word_count} words.")
                    return text

                except Exception as e:
                    err_str = str(e)
                    last_error = e
                    logger.warning(f"Model '{model_name}' attempt {attempt}/{max_retries} failed: {e}")
                    
                    # If 404 NOT_FOUND, break immediately to try next model candidate
                    if "404" in err_str or "NOT_FOUND" in err_str:
                        logger.info(f"Model '{model_name}' is not recognized or available. Switching to next fallback model...")
                        break
                    
                    # If 503 high demand or temporary server error, try next model candidate
                    if "503" in err_str or "UNAVAILABLE" in err_str:
                        logger.info(f"Model '{model_name}' is experiencing high demand (503). Switching to fallback model...")
                        break

                    if attempt < max_retries:
                        time.sleep(backoff_sec * attempt)

        # If all candidates fail
        raise RuntimeError(f"All Gemini model candidates failed. Last error: {last_error}")


# ==============================================================================
# STEP 3: BLOGGER FORMATTER & HTML ENGINE
# ==============================================================================
class BloggerContentFormatter:
    """
    Parses Markdown, extracts SEO metadata, formats code blocks, and converts
    [IMAGE_SUGGESTION: ...] tags into responsive Blogger-friendly HTML cards.
    """

    @classmethod
    def parse_seo_metadata(cls, raw_markdown: str) -> Tuple[str, Dict[str, str]]:
        """Extracts the SEO metadata block from the markdown content."""
        metadata = {
            "title": "",
            "description": "",
            "keywords": []
        }

        pattern = r"### SEO_METADATA_START\s*(.*?)\s*### SEO_METADATA_END"
        match = re.search(pattern, raw_markdown, re.DOTALL)
        clean_markdown = raw_markdown

        if match:
            meta_block = match.group(1)
            # Remove metadata block from main body text
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
        """Extracts the H1 heading as the post title, or falls back to topic."""
        # Find first '# Title'
        for line in markdown_text.splitlines():
            line_s = line.strip()
            if line_s.startswith("# "):
                return line_s[2:].strip().replace('"', '')
        return fallback_title

    @classmethod
    def convert_image_suggestions_to_html(cls, html_content: str) -> str:
        """
        Transforms [IMAGE_SUGGESTION: ...] into real, high-resolution AI tech images
        embedded directly into the Blogger HTML with responsive styling, rounded corners,
        alt tags, and figure captions.
        """
        image_index = 0

        def replace_match(match):
            nonlocal image_index
            image_index += 1
            prompt = match.group(1).strip()

            if Config.EMBED_REAL_IMAGES:
                # Generate real AI image URL via Pollinations AI (Zero API key required)
                encoded_prompt = urllib.parse.quote(f"{prompt}, high quality 4k tech illustration, modern tech aesthetic")
                image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1200&height=675&nologo=true"
                alt_text = html.escape(prompt[:120])
                caption_text = html.escape(prompt)

                return f"""
<figure class="blogger-article-image" style="margin: 32px 0; text-align: center;">
  <img src="{image_url}" alt="{alt_text}" style="width: 100%; max-width: 820px; height: auto; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); display: block; margin: 0 auto; object-fit: cover;" loading="lazy" />
  <figcaption style="margin-top: 10px; font-size: 13px; color: #64748b; font-style: italic; line-height: 1.4;">
    Figure {image_index}: {caption_text}
  </figcaption>
</figure>
"""
            else:
                return f"""
<div class="blogger-image-placeholder" style="margin: 28px 0; padding: 18px 22px; background: #0f172a; border-left: 4px solid #38bdf8; border-radius: 8px; color: #f1f5f9; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;">
  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
    <span style="display: inline-block; width: 10px; height: 10px; background-color: #38bdf8; border-radius: 50%;"></span>
    <strong style="color: #38bdf8; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Suggested Visual Asset #{image_index}</strong>
  </div>
  <p style="margin: 0 0 6px 0; font-size: 14px; font-style: italic; color: #cbd5e1; line-height: 1.5;">"{prompt}"</p>
  <span style="font-size: 11px; color: #94a3b8;">Insert your banner or generated illustration here prior to publishing.</span>
</div>
"""

        pattern = r"\[IMAGE_SUGGESTION:\s*([^\]]+)\]"
        return re.sub(pattern, replace_match, html_content)

    @classmethod
    def format_to_blogger_html(cls, markdown_text: str) -> str:
        """Converts Markdown text into clean, Blogger-ready HTML."""
        if markdown is not None:
            # Full Markdown parsing with code fence and table support
            html = markdown.markdown(
                markdown_text,
                extensions=['fenced_code', 'tables', 'nl2br']
            )
        else:
            # Fallback simple converter if markdown module is not installed
            html = cls._simple_markdown_fallback(markdown_text)

        # Style code blocks with dark theme suitable for Blogger
        html = re.sub(
            r'<pre><code>',
            r'<pre style="background: #1e293b; color: #f8fafc; padding: 16px; border-radius: 8px; overflow-x: auto; font-family: Consolas, Monaco, monospace; font-size: 14px; line-height: 1.6;"><code>',
            html
        )

        # Style blockquotes
        html = re.sub(
            r'<blockquote>',
            r'<blockquote style="border-left: 4px solid #64748b; padding-left: 16px; margin: 16px 0; color: #475569; font-style: italic;">',
            html
        )

        # Transform [IMAGE_SUGGESTION: ...] placeholders into aesthetic visual cards
        html = cls.convert_image_suggestions_to_html(html)

        return html

    @classmethod
    def _simple_markdown_fallback(cls, text: str) -> str:
        """Lightweight regex-based fallback converter for environments without python-markdown."""
        lines = text.splitlines()
        output = []
        in_p = False

        for line in lines:
            line_s = line.strip()
            if not line_s:
                if in_p:
                    output.append("</p>")
                    in_p = False
                continue

            if line_s.startswith("### "):
                if in_p: output.append("</p>"); in_p = False
                output.append(f"<h3>{line_s[4:]}</h3>")
            elif line_s.startswith("## "):
                if in_p: output.append("</p>"); in_p = False
                output.append(f"<h2>{line_s[3:]}</h2>")
            elif line_s.startswith("# "):
                if in_p: output.append("</p>"); in_p = False
                output.append(f"<h1>{line_s[2:]}</h1>")
            else:
                if not in_p:
                    output.append("<p>")
                    in_p = True
                output.append(line_s)

        if in_p:
            output.append("</p>")

        return "\n".join(output)


# ==============================================================================
# STEP 4: GOOGLE BLOGGER API v3 CLIENT (Draft Staging Only)
# ==============================================================================
class BloggerClient:
    """
    Handles authentication and interactions with Google Blogger API v3.
    Enforces `isDraft=True` to stage posts safely for manual review.
    """

    def __init__(self, blog_id: Optional[str] = None):
        self.blog_id = blog_id or Config.BLOGGER_BLOG_ID
        if not self.blog_id:
            raise ValueError(
                "Blogger Blog ID is missing! Set BLOGGER_BLOG_ID in your .env or environment variables."
            )
        self.service = self._authenticate()

    def _authenticate(self):
        """
        Authenticates via OAuth 2.0 InstalledAppFlow or existing token.json.
        Refreshes tokens automatically for headless execution.
        """
        try:
            from google.auth.transport.requests import Request
            from google.oauth2.credentials import Credentials
            from google_auth_oauthlib.flow import InstalledAppFlow
            from googleapiclient.discovery import build
        except ImportError as e:
            raise ImportError(
                "Missing Google API libraries. Please run:\n"
                "pip install google-api-python-client google-auth-oauthlib"
            ) from e

        creds = None
        # Load existing saved tokens if available
        if os.path.exists(Config.TOKEN_FILE):
            try:
                creds = Credentials.from_authorized_user_file(Config.TOKEN_FILE, Config.BLOGGER_SCOPES)
            except Exception as e:
                logger.warning(f"Could not load token file: {e}")

        # If no valid credentials, run interactive OAuth flow or refresh
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                logger.info("Refreshing expired Google OAuth access token...")
                creds.refresh(Request())
            else:
                if not os.path.exists(Config.CLIENT_SECRETS_FILE):
                    raise FileNotFoundError(
                        f"OAuth client secrets file '{Config.CLIENT_SECRETS_FILE}' not found!\n"
                        f"Please download it from Google Cloud Console -> APIs & Services -> Credentials\n"
                        f"and place it in the same directory as this script."
                    )
                logger.info("Initiating Google OAuth2 authorization flow...")
                flow = InstalledAppFlow.from_client_secrets_file(
                    Config.CLIENT_SECRETS_FILE,
                    Config.BLOGGER_SCOPES
                )
                creds = flow.run_local_server(port=0)

            # Persist token for future headless runs
            with open(Config.TOKEN_FILE, "w") as token:
                token.write(creds.to_json())
            logger.info(f"OAuth credentials saved to '{Config.TOKEN_FILE}'.")

        service = build("blogger", "v3", credentials=creds)
        
        # Verify blog connection
        try:
            blog_info = service.blogs().get(blogId=self.blog_id).execute()
            logger.info(f"Connected to Blogger: '{blog_info.get('name')}' (URL: {blog_info.get('url')})")
        except Exception as e:
            logger.error(f"Failed to verify Blog ID {self.blog_id}. Check permissions and Blog ID: {e}")
            raise

        return service

    def create_draft_post(
        self,
        title: str,
        content_html: str,
        labels: Optional[List[str]] = None,
        meta_description: Optional[str] = None
    ) -> Dict[str, any]:
        """
        Creates a new post on Blogger with `isDraft=True`.
        Guaranteed NEVER to publish automatically.
        """
        post_body = {
            "kind": "blogger#post",
            "title": title,
            "content": content_html,
            "labels": labels or ["Technology", "Tech Trends", "AI", "Software"],
            "status": "DRAFT"
        }

        # Some Blogger templates support custom search descriptions via post body
        if meta_description:
            post_body["searchDescription"] = meta_description[:160]

        logger.info(f"Uploading draft to Blogger Blog ID: {self.blog_id}...")
        
        # isDraft=True is the CRITICAL safety flag
        request = self.service.posts().insert(
            blogId=self.blog_id,
            body=post_body,
            isDraft=True
        )
        post_response = request.execute()
        
        post_id = post_response.get("id")
        post_url = post_response.get("url")
        edit_url = f"https://www.blogger.com/blog/post/edit/{self.blog_id}/{post_id}"
        
        logger.info(f"Draft successfully saved! Post ID: {post_id}")
        logger.info(f"Edit & Review URL: {edit_url}")

        return {
            "id": post_id,
            "url": post_url,
            "edit_url": edit_url,
            "title": post_response.get("title"),
            "status": "DRAFT"
        }


# ==============================================================================
# PIPELINE ORCHESTRATOR
# ==============================================================================
class BloggerAutomationPipeline:
    """
    Coordinates the 4-step workflow:
      1. Trends Research
      2. Gemini Content Generation
      3. HTML & SEO Formatting
      4. Blogger Draft Creation
    """

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.gemini_engine = GeminiContentEngine()
        self.blogger_client = None if dry_run else BloggerClient()

    def process_topic(self, topic_info: Dict[str, str]) -> Optional[Dict[str, any]]:
        """Processes a single topic from generation to draft staging."""
        title_topic = topic_info["title"]
        geo = topic_info.get("geo", "US")

        print("\n" + "=" * 70)
        logger.info(f"PROCESSING TOPIC: '{title_topic}' [Region: {geo}]")
        print("=" * 70)

        # 1. Gemini Content Generation
        try:
            raw_markdown = self.gemini_engine.generate_article(title_topic, geo)
        except Exception as e:
            logger.error(f"Failed to generate article for '{title_topic}': {e}")
            return None

        # 2. Extract SEO metadata & format HTML
        clean_markdown, seo_meta = BloggerContentFormatter.parse_seo_metadata(raw_markdown)
        article_title = seo_meta.get("title") or BloggerContentFormatter.extract_post_title(clean_markdown, title_topic)
        html_content = BloggerContentFormatter.format_to_blogger_html(clean_markdown)

        # Generate tags/labels
        labels = ["Technology", f"Tech Trends {geo}"]
        if seo_meta.get("keywords"):
            labels.extend(seo_meta["keywords"][:4])
        labels = list(dict.fromkeys(labels))  # Deduplicate

        logger.info(f"Article Prepared:")
        logger.info(f"  Title: {article_title}")
        logger.info(f"  SEO Meta Description: {seo_meta.get('description', 'N/A')}")
        logger.info(f"  HTML Length: {len(html_content)} characters")
        logger.info(f"  Labels: {', '.join(labels)}")

        # 3. Save to Blogger (or preview in Dry-Run)
        if self.dry_run:
            logger.info("[DRY-RUN MODE] Skipping Blogger API call.")
            # Save local HTML preview for inspection
            filename = f"preview_{int(time.time())}_{re.sub(r'[^a-zA-Z0-9]', '_', title_topic)[:25]}.html"
            with open(filename, "w", encoding="utf-8") as f:
                f.write(f"<!-- Title: {article_title} -->\n{html_content}")
            logger.info(f"[DRY-RUN MODE] HTML preview saved to: {filename}")

            # Record in persistent history memory to prevent future duplicates
            HistoryManager.record_entry(
                topic=title_topic,
                title=article_title,
                geo=geo,
                post_id="dry-run-preview",
                is_draft=True
            )

            return {
                "title": article_title,
                "status": "DRAFT (DRY RUN)",
                "id": "dry-run-preview",
                "preview_file": filename
            }

        try:
            draft_result = self.blogger_client.create_draft_post(
                title=article_title,
                content_html=html_content,
                labels=labels,
                meta_description=seo_meta.get("description")
            )

            # Record in persistent memory database
            HistoryManager.record_entry(
                topic=title_topic,
                title=article_title,
                geo=geo,
                post_id=str(draft_result.get("id", "blogger-draft")),
                is_draft=True
            )

            return draft_result
        except Exception as e:
            logger.error(f"Failed to stage draft on Blogger: {e}")
            return None

    def run_batch(self, count: int = 5) -> List[Dict[str, any]]:
        """Executes a full run generating exactly `count` distinct drafts."""
        start_time = datetime.now()
        logger.info(f"=== INITIATING BLOGGER AUTOMATION RUN ({count} Tech Drafts) ===")

        # Step 1: Research Top Tech Trends
        trends = TechTrendResearcher.get_top_tech_trends(max_count=count)
        if not trends:
            logger.error("No trending tech topics could be extracted. Aborting batch.")
            return []

        results = []
        for index, topic in enumerate(trends, 1):
            logger.info(f"\nProcessing {index} of {len(trends)}...")
            res = self.process_topic(topic)
            if res:
                results.append(res)

            # Rate limit politeness between generations
            if index < len(trends):
                logger.info(f"Waiting {Config.INTER_POST_DELAY}s before next topic to respect API quotas...")
                time.sleep(Config.INTER_POST_DELAY)

        duration = (datetime.now() - start_time).total_seconds()
        print("\n" + "=" * 70)
        logger.info(f"BATCH COMPLETE! Created {len(results)}/{len(trends)} drafts in {duration:.1f}s.")
        for r in results:
            logger.info(f" - {r['title']} -> Status: {r['status']} | ID: {r.get('id')}")
        print("=" * 70 + "\n")

        return results


# ==============================================================================
# CLI ENTRY POINT & SCHEDULER
# ==============================================================================
def main():
    parser = argparse.ArgumentParser(
        description="Automated Tech Blogging Engine (Google Trends + Gemini + Blogger API)"
    )
    parser.add_argument(
        "--count",
        type=int,
        default=Config.TARGET_POSTS_COUNT,
        help="Number of drafts to generate (Default: 5)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate trends research and Gemini generation without pushing to Blogger"
    )
    parser.add_argument(
        "--mode",
        choices=["once", "daemon"],
        default="once",
        help="'once' generates the batch and exits. 'daemon' runs periodically in the background."
    )
    parser.add_argument(
        "--interval-hours",
        type=int,
        default=4,
        help="Hours to sleep between batches when running in '--mode daemon' (Default: 4 hours)"
    )
    parser.add_argument(
        "--history",
        action="store_true",
        help="Display list of all previously generated topics in persistent memory"
    )
    parser.add_argument(
        "--clear-history",
        action="store_true",
        help="Clear the memory database (published_history.json) to start fresh"
    )

    args = parser.parse_args()

    # Handle history inspection or reset commands
    if args.history:
        HistoryManager.print_history_summary()
        sys.exit(0)

    if args.clear_history:
        HistoryManager.clear_history()
        sys.exit(0)

    # Verify Configuration (unless dry-run without credentials)
    if not Config.GEMINI_API_KEY:
        print("\n[ERROR] GEMINI_API_KEY is not set.")
        print("Please set your Gemini API key in a .env file or export GEMINI_API_KEY='your-key'.")
        print("Obtain a free key at https://aistudio.google.com/app/apikey\n")
        sys.exit(1)

    if not args.dry_run and not Config.BLOGGER_BLOG_ID:
        print("\n[ERROR] BLOGGER_BLOG_ID is not set.")
        print("Please set your Blogger Blog ID in a .env file or export BLOGGER_BLOG_ID='your-id'.")
        print("Find your ID in the Blogger URL: https://www.blogger.com/blog/posts/<BLOG_ID>\n")
        sys.exit(1)

    pipeline = BloggerAutomationPipeline(dry_run=args.dry_run)

    if args.mode == "once":
        pipeline.run_batch(count=args.count)
    elif args.mode == "daemon":
        logger.info(f"Starting in Daemon mode. Running every {args.interval_hours} hours. Press Ctrl+C to stop.")
        while True:
            try:
                pipeline.run_batch(count=args.count)
                sleep_seconds = args.interval_hours * 3600
                logger.info(f"Sleeping for {args.interval_hours} hours until next cycle...")
                time.sleep(sleep_seconds)
            except KeyboardInterrupt:
                logger.info("Daemon stopped by user.")
                break
            except Exception as e:
                logger.error(f"Unexpected error in daemon loop: {e}")
                time.sleep(300)  # Sleep 5 min on error before retrying


if __name__ == "__main__":
    main()
