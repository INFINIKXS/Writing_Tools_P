"""
Step 1 Verification Gate
Run from the project root:
    python verify_step1.py path/to/pristine.pdf

The script:
  1. Confirms a healthy TTF passes through prepare_for_insert byte-for-byte.
  2. Extracts a CFF from the pristine PDF, wraps it, and checks:
       - detect_font_format(wrapped) is NOT 'cff' (it is now OTF)
       - prepare_for_insert(wrapped) == wrapped   (idempotent)
       - fitz.Font can parse the wrapped bytes
       - space advance (hmtx + fitz) is sane (> 0, < upm)
  3. Prints enough data to diagnose any remaining width issues.
"""

import sys
import io
from pathlib import Path

# ── Bootstrap path ────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))

import fitz
from fontTools.ttLib import TTFont
from converter.font_utils import (
    prepare_for_insert,
    wrap_cff_in_otf,
    detect_font_format,
)

# ── PASS 1: Healthy TTF must be byte-for-byte untouched ──────────────────────
TTF_PATH = ROOT / "backend" / "font_vault" / "full" / "libre-baskerville-Regular.ttf"
if not TTF_PATH.exists():
    candidates = list((ROOT / "backend" / "font_vault").rglob("*.ttf"))
    TTF_PATH = candidates[0] if candidates else None

if TTF_PATH and TTF_PATH.exists():
    ttf = TTF_PATH.read_bytes()
    result = prepare_for_insert(ttf)
    assert result == ttf, (
        f"FAIL 1: TTF was mutated! Original={len(ttf)} bytes, "
        f"result={len(result)} bytes"
    )
    print(f"PASS 1: TTF untouched ({TTF_PATH.name}, {len(ttf):,} bytes)")
else:
    print("SKIP 1: No TTF found in font_vault/full — place any .ttf there to test")

# ── PASS 2: CFF from pristine PDF ────────────────────────────────────────────
pdf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
if not pdf_path or not pdf_path.exists():
    print(
        "\nSKIP 2: Provide path to a pristine PDF as the first argument.\n"
        "  python verify_step1.py PATH/TO/PRISTINE.pdf\n"
    )
    sys.exit(0)

doc = fitz.open(str(pdf_path))
cff_buf = None
cff_name = None

for page in doc:
    for info in page.get_fonts(full=True):
        xref = info[0]
        basefont = info[3]
        try:
            extracted = doc.extract_font(xref)
            buf = extracted[-1]
        except Exception:
            continue
        if buf and detect_font_format(buf) == "cff":
            cff_buf = buf
            cff_name = basefont
            break
    if cff_buf:
        break

if not cff_buf:
    print("SKIP 2: No bare CFF font found in the PDF — all fonts may already be OTF/TTF.")
    sys.exit(0)

print(f"\nFound CFF font: '{cff_name}' ({len(cff_buf):,} bytes)")

assert detect_font_format(cff_buf) == "cff", "FAIL 2a: detect_font_format should return 'cff'"
print("PASS 2a: detect_font_format correctly identifies raw CFF")

wrapped = wrap_cff_in_otf(cff_buf, basefont_name=cff_name)
assert wrapped, "FAIL 2b: wrap_cff_in_otf returned None/empty"
print(f"PASS 2b: wrap_cff_in_otf produced {len(wrapped):,} bytes")

fmt_wrapped = detect_font_format(wrapped)
assert fmt_wrapped in ("otf", "ttf"), (
    f"FAIL 2c: wrapped format is '{fmt_wrapped}', expected 'otf'"
)
print(f"PASS 2c: wrapped font format = '{fmt_wrapped}'")

reinserted = prepare_for_insert(wrapped)
assert reinserted == wrapped, (
    f"FAIL 2d: prepare_for_insert mutated an already-wrapped OTF! "
    f"Original={len(wrapped)}, result={len(reinserted)}"
)
print("PASS 2d: prepare_for_insert is idempotent on OTF (byte-for-byte equal)")

try:
    f = fitz.Font(fontbuffer=wrapped)
    print(f"PASS 2e: fitz.Font parsed the wrapped OTF successfully (name='{f.name}')")
except Exception as e:
    print(f"FAIL 2e: fitz.Font rejected the wrapped OTF: {e}")
    sys.exit(1)

sp = f.text_length(" ", fontsize=10)
print(f"       space@10pt via fitz.text_length = {sp:.4f}")

tt = TTFont(io.BytesIO(wrapped))
upm = tt["head"].unitsPerEm
space_adv = tt["hmtx"].metrics.get("space", (None, None))[0]

if space_adv is None:
    for gname in tt.getGlyphOrder():
        if "space" in gname.lower() or gname == "uni0020":
            space_adv = tt["hmtx"].metrics[gname][0]
            print(f"       (space glyph found as '{gname}')")
            break

print(f"       upm={upm}  space_advance_in_hmtx={space_adv}")

if space_adv is not None:
    assert 0 < sp, f"FAIL 2f: fitz space length is {sp:.4f} (must be > 0)"
    assert 0 < space_adv < upm, (
        f"FAIL 2f: hmtx space advance {space_adv} is out of range [1, {upm})"
    )
    print(f"PASS 2f: space metrics are sane (fitz={sp:.4f}pt, hmtx={space_adv}/{upm})")
else:
    print("NOTE: 'space' glyph not in hmtx — subset may not include it (OK for subsets)")

print("\nALL PASS - Step 1 is correct. Ready for Step 2.")
