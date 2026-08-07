import sys
import logging
from pathlib import Path
from unittest.mock import patch

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import fitz
from converter.font_utils import _find_missing_glyphs

def test_find_missing_glyphs_render_probe(caplog):
    mock_font_buf = b"fake_font_buffer_bytes"
    
    def mock_glyph_has_ink(buf, ch, fontsize=20):
        if ch == 'N':
            return False
        return True

    with patch("converter.font_utils._glyph_has_ink", side_effect=mock_glyph_has_ink):
        with caplog.at_level(logging.WARNING):
            missing = _find_missing_glyphs(None, "BANANA", font_buffer=mock_font_buf)
            
    assert missing == {'N'}
    assert "GLYPH-DETECTOR: subset font lacks ink for ['N']" in caplog.text

def test_find_missing_glyphs_empty():
    assert _find_missing_glyphs(None, "   ", font_buffer=b"buf") == set()
