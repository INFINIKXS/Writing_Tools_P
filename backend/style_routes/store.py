"""
Style Profile persistence layer.

Stores one profile per installation as a JSON file under backend/style_profiles/.
The latest profile is always pointed to by latest.json (a symlink-equivalent: a
small JSON file containing the profile_id of the current profile).

To swap for Supabase: replace save_profile / load_profile / delete_profile
with Supabase upsert / select / delete calls on a `style_profiles` table.
"""
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Profiles directory lives next to this package inside the backend folder
_HERE = Path(__file__).parent.parent  # backend/
PROFILES_DIR = _HERE / "style_profiles"
LATEST_FILE = PROFILES_DIR / "latest.json"


def _ensure_dir() -> None:
    PROFILES_DIR.mkdir(exist_ok=True)


def save_profile(metrics: dict, semantic: dict, word_count: int) -> dict:
    """
    Assemble and persist a full Style Profile from metric + semantic outputs.
    Returns the assembled profile dict.
    """
    _ensure_dir()

    profile_id = str(uuid.uuid4())
    profile = {
        "profile_id": profile_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "word_count_analysed": word_count,
        "metrics": metrics,
        "semantic": semantic,
    }

    # Write the profile itself
    profile_path = PROFILES_DIR / f"{profile_id}.json"
    profile_path.write_text(json.dumps(profile, indent=2, ensure_ascii=False), encoding="utf-8")

    # Update the latest pointer
    LATEST_FILE.write_text(json.dumps({"profile_id": profile_id}), encoding="utf-8")

    return profile


def load_profile() -> dict | None:
    """
    Load and return the latest saved Style Profile, or None if none exists.
    """
    _ensure_dir()
    if not LATEST_FILE.exists():
        return None

    try:
        pointer = json.loads(LATEST_FILE.read_text(encoding="utf-8"))
        profile_id = pointer.get("profile_id")
        profile_path = PROFILES_DIR / f"{profile_id}.json"
        if not profile_path.exists():
            return None
        return json.loads(profile_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, KeyError, OSError):
        return None


def delete_profile() -> bool:
    """
    Delete the latest profile and the pointer file.
    Returns True if a profile was deleted, False if none existed.
    """
    _ensure_dir()
    if not LATEST_FILE.exists():
        return False

    try:
        pointer = json.loads(LATEST_FILE.read_text(encoding="utf-8"))
        profile_id = pointer.get("profile_id")
        profile_path = PROFILES_DIR / f"{profile_id}.json"
        if profile_path.exists():
            profile_path.unlink()
        LATEST_FILE.unlink()
        return True
    except (json.JSONDecodeError, KeyError, OSError):
        # Clean up the pointer even if the profile file is missing
        if LATEST_FILE.exists():
            LATEST_FILE.unlink()
        return True
