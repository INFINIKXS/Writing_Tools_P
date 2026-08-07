import sys
import logging
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import fitz
from converter.font_utils import get_font_for_edit, canonical_family, VAULT_DIR
from converter.font_vault import vault_cover_for, vault_full_for, _find_entry, _read_manifest
from converter.pdf_edit import _build_glyph_resolver, _resolve_primary_buffer

def test_two_bake_font_identity_and_vault_routing(caplog):
    font_path = None
    for sub in ("full", "subsets", "buffers"):
        matches = [p for p in list((VAULT_DIR / sub).glob("*baskerville*")) if p.is_file()]
        if matches:
            font_path = matches[0]
            break
    assert font_path is not None, "A font file should exist in VAULT_DIR"
    font_bytes = font_path.read_bytes()
    font_name = font_path.stem
    
    doc = fitz.open()
    page = doc.new_page()
    page.insert_font(fontname=font_name, fontbuffer=font_bytes)
    
    edit = {
        "pageNum": 1,
        "fontName": font_name,
        "newStr": "The quick brown fox worked so but",
        "rect": {"w": 200, "h": 50},
        "isBold": False,
        "isItalic": False,
    }
    
    res = get_font_for_edit(doc, page, edit)
    # Ensure no 'emb_' prefix or [:20] truncation
    assert not res.fontname.startswith("emb_")
    assert canonical_family(font_name) in canonical_family(res.fontname)
    
    # 2. Verify vault resolution for novel characters
    fam = canonical_family(res.fontname)
    assert fam in ("newbaskerville", "librebaskerville")
    
    mf = _read_manifest()
    entry = _find_entry(mf, fam)
    assert entry is not None, f"Vault entry for family '{fam}' should be found"
    
    font_buffer_map = {res.fontname: font_bytes}
    with caplog.at_level(logging.DEBUG):
        resolver = _build_glyph_resolver(doc, font_buffer_map, res.fontname, {'w', 'k', 'T'})
        
    assert 'w' in resolver
    assert 'k' in resolver
    assert 'T' in resolver
    
    # Ensure SCAVENGE or VAULT logging output
    assert ("SCAVENGE: 'w' served by" in caplog.text) or ("VAULT: 'w' served by" in caplog.text)
    
    doc.close()
