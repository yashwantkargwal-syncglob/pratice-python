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
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    BLOGGER_SCOPES: List[str] = ["https://www.googleapis.com/auth/blogger"]
    INTER_POST_DELAY: int = int(os.getenv("INTER_POST_DELAY", "20"))
