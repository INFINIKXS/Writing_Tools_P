import os
import socket
from urllib.parse import urlparse
try:
    from supabase import create_client, Client
    SUPABASE_INSTALLED = True
except ImportError:
    SUPABASE_INSTALLED = False
    create_client = None
    Client = object

from dotenv import load_dotenv

load_dotenv()

def is_supabase_reachable(url: str) -> bool:
    if not SUPABASE_INSTALLED or not url or "your-project" in url:
        return False
    try:
        parsed = urlparse(url)
        host = parsed.hostname
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        with socket.create_connection((host, port), timeout=0.5):
            return True
    except Exception:
        return False

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_OFFLINE = not is_supabase_reachable(SUPABASE_URL)

def get_supabase():
    if not SUPABASE_INSTALLED or not create_client:
        return None
    url = os.environ.get("SUPABASE_URL", "https://placeholder.supabase.co")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "placeholder")
    return create_client(url, key)

# Singleton — import this from anywhere in the backend
supabase: Client = get_supabase()

