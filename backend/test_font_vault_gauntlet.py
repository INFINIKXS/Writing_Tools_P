import os
import sys
import pytest
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

import fitz
from converter.font_vault import vault_list, vault_cover_for, vault_full_for, VAULT_DIR
from converter.font_utils import root_family
from converter.pdf_edit import _build_glyph_resolver
from fastapi.testclient import TestClient
from main import app

def test_gauntlet_step1_fetch_and_manifest():
    mf = vault_list()
    assert isinstance(mf, dict)
    assert len(mf) > 0, "Manifest should have entries"
    # Check two families in manifest
    assert any(root_family(k) in ("newbaskerville", "helveticaneueltstd", "bookantiqua", "arial", "helvetica") for k in mf.keys())
    for fam, entry in mf.items():
        assert "coverage" in entry
        assert "license" in entry

def test_gauntlet_step3_vault_api():
    client = TestClient(app)
    # Test GET /api/pdf/vault/manifest
    res_mf = client.get("/api/pdf/vault/manifest")
    assert res_mf.status_code == 200
    mf_data = res_mf.json()
    assert isinstance(mf_data, dict)

    # Test GET /api/pdf/vault/font/libre-baskerville-Regular.ttf
    res_font = client.get("/api/pdf/vault/font/libre-baskerville-Regular.ttf")
    assert res_font.status_code == 200
    assert res_font.headers["content-type"] == "font/otf"
    assert "immutable" in res_font.headers.get("cache-control", "")

def test_gauntlet_step4_and_step5_vault_resolution():
    # Test vault resolution for a character like '€' or 'Ž' in NewBaskerville family
    ch = "€"
    fam = "NewBaskerville-Roman"
    
    # 1. Test vault_cover_for directly
    vault_hit = vault_cover_for(fam, ch)
    assert vault_hit is not None, f"Vault cover for '{fam}' character '{ch}' should resolve"
    font_name, font_buf = vault_hit
    assert len(font_buf) > 0

    # 2. Test _build_glyph_resolver tier logging / resolution
    doc = fitz.open()
    doc.new_page()
    font_buffer_map = {}
    resolver = _build_glyph_resolver(doc, font_buffer_map, fam, {ch})
    doc.close()
    
    assert ch in resolver
    res_name, res_font = resolver[ch]
    assert font_buffer_map.get(res_name) is not None

def test_import_cycle_safety():
    # Verify importing modules in any order causes no circular imports
    import converter.font_utils
    import converter.font_vault
    import converter.pdf_edit
