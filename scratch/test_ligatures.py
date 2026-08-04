import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from pdf_routes.editor import normalize_pdf_text

def test_ligature_normalization():
    sample_text = "given \uFB01nal approval of the version to be published. participated suf\uFB03ciently"
    normalized = normalize_pdf_text(sample_text)
    print(f"Original:   {sample_text!r}")
    print(f"Normalized: {normalized!r}")
    assert "final" in normalized, f"Expected 'final' in normalized text, got: {normalized}"
    assert "sufficiently" in normalized, f"Expected 'sufficiently' in normalized text, got: {normalized}"
    print("SUCCESS: Ligature normalization test passed!")

if __name__ == "__main__":
    test_ligature_normalization()
