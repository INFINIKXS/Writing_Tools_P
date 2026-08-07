import sys
import logging
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import fitz
from converter.font_utils import canonical_family, VAULT_DIR
from converter.font_vault import vault_full_for, vault_cover_for, _find_entry, _read_manifest
from converter.pdf_edit import _primary_bad_chars

def test_font_promotion_and_bake_stability(caplog):
    # 1. Obtain vault full font hit dynamically
    fam = canonical_family("OPYJSL+NewBaskerville-Roman")
    hit = vault_full_for(fam) or vault_cover_for(fam, "w")
    assert hit is not None, "Vault entry for family should exist"
    pname, pbuf = hit
    assert "libre-baskerville" in pname
    
    # 2. Verify hardened _primary_bad_chars when buf is None
    doc = fitz.open()
    font_obj = fitz.Font(fontbuffer=pbuf)
    
    bad_none_buf = _primary_bad_chars(font_obj, None, "The quick brown fox 🦊")
    assert "🦊" in bad_none_buf
    assert "e" not in bad_none_buf
    
    doc.close()
