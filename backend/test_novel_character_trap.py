import sys
import logging
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import pytest

def test_novel_character_trap_logic():
    plan = {
        "fontname": "ABCDEF+NewBaskerville-Roman",
        "origStr": "The quick brown fox",
    }
    paragraph_text = "The quick brown fox jumped over the lazy dog"
    
    orig_str = plan.get("origStr", "") or ""
    novel_chars = set(paragraph_text) - set(orig_str)
    novel_chars = {ch for ch in novel_chars if not ch.isspace()}
    
    expected_novel = set(paragraph_text) - set("The quick brown fox") - {' '}
    assert novel_chars == expected_novel
    assert "k" not in novel_chars  # 'k' was in origStr
    assert "j" in novel_chars      # 'j' is novel
    assert "+" in plan["fontname"]
