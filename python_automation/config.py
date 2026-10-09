"""
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
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    BLOGGER_SCOPES: List[str] = ["https://www.googleapis.com/auth/blogger"]
    INTER_POST_DELAY: int = int(os.getenv("INTER_POST_DELAY", "20"))
    
    # Publication Status ('DRAFT' or 'LIVE')
    BLOG_POST_STATUS: str = os.getenv("BLOG_POST_STATUS", os.getenv("BLOGGER_POST_STATUS", "DRAFT")).strip().upper()

    # Images Setup
    INCLUDE_IMAGES: bool = os.getenv("INCLUDE_IMAGES", "true").lower() in ("true", "1", "yes")
    IMAGE_MODE: str = os.getenv("IMAGE_MODE", "direct").strip().lower()

    # Internal Backlinks
    ENABLE_INTERNAL_LINKING: bool = os.getenv("ENABLE_INTERNAL_LINKING", "true").lower() in ("true", "1", "yes")
    MAX_INTERNAL_BACKLINKS: int = int(os.getenv("MAX_INTERNAL_BACKLINKS", os.getenv("MAX_INTERNAL_LINKS", "2")))

    # Memory Database
    HISTORY_FILE: str = os.getenv("HISTORY_FILE", "published_history.json")
