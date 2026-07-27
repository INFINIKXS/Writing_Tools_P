"""
Changelog Archiver — Automatically copies walkthrough.md artifacts into the
project's changelog/ folder with a timestamped filename.

Usage:
    python changelog/archive.py                          # uses default artifacts path
    python changelog/archive.py --source path/to/walkthrough.md   # explicit source
    python changelog/archive.py --title "My feature name"         # custom title slug
"""
import shutil
import argparse
import os
import re
from datetime import datetime
from pathlib import Path

# ── Defaults ─────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CHANGELOG_DIR = PROJECT_ROOT / "changelog"
DEFAULT_ARTIFACTS_GLOB = Path(os.path.expanduser("~")) / ".gemini" / "antigravity" / "brain"


def find_latest_walkthrough() -> Path | None:
    """Walk the artifacts brain directory and find the most recently modified walkthrough.md."""
    candidates = list(DEFAULT_ARTIFACTS_GLOB.rglob("walkthrough.md"))
    if not candidates:
        return None
    # Return the most recently modified one
    return max(candidates, key=lambda p: p.stat().st_mtime)


def slugify(text: str) -> str:
    """Convert a title string into a filesystem-safe slug."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '_', text)
    return text.strip('_')


def extract_title_from_md(md_path: Path) -> str:
    """Extract the first H1 heading from a markdown file as the title slug."""
    try:
        with open(md_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('# '):
                    return line[2:].strip()
    except Exception:
        pass
    return "walkthrough"


def archive_walkthrough(source: Path | None = None, title: str | None = None) -> Path:
    """
    Copy a walkthrough.md into the changelog/ folder with a timestamped name.
    
    Returns the path to the newly created changelog entry.
    """
    # 1. Find the source walkthrough
    if source is None:
        source = find_latest_walkthrough()
    if source is None or not source.exists():
        raise FileNotFoundError(
            f"No walkthrough.md found. Searched in: {DEFAULT_ARTIFACTS_GLOB}\n"
            f"Use --source to specify the path explicitly."
        )

    # 2. Build the timestamped filename
    now = datetime.now()
    timestamp = now.strftime("%Y-%m-%d_%H%M%S")
    
    if title is None:
        title = extract_title_from_md(source)
    
    slug = slugify(title)
    filename = f"{timestamp}_{slug}.md"

    # 3. Ensure changelog/ exists
    CHANGELOG_DIR.mkdir(parents=True, exist_ok=True)

    # 4. Copy the file
    dest = CHANGELOG_DIR / filename
    shutil.copy2(source, dest)

    # 5. Prepend a metadata header to the archived copy
    with open(dest, 'r', encoding='utf-8') as f:
        content = f.read()

    header = (
        f"---\n"
        f"archived: {now.isoformat()}\n"
        f"source: {source}\n"
        f"---\n\n"
    )

    with open(dest, 'w', encoding='utf-8') as f:
        f.write(header + content)

    return dest


def main():
    parser = argparse.ArgumentParser(description="Archive a walkthrough.md into the changelog folder.")
    parser.add_argument("--source", type=Path, default=None, help="Path to the walkthrough.md to archive.")
    parser.add_argument("--title", type=str, default=None, help="Custom title slug for the filename.")
    args = parser.parse_args()

    try:
        dest = archive_walkthrough(source=args.source, title=args.title)
        print(f"Archived walkthrough to: {dest}")
    except FileNotFoundError as e:
        print(f"Error: {e}")
        exit(1)


if __name__ == "__main__":
    main()
