import os
import sys
import json
import tempfile
import fitz
from pathlib import Path

# Ensure unbuffered output
sys.stdout.reconfigure(line_buffering=True)

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def create_test_pdf_with_text(filepath, lines):
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    y = 100
    for line in lines:
        page.insert_text((50, y), line, fontsize=12, fontname="helv")
        y += 30
    doc.save(filepath)
    doc.close()

def test_apply_edits_plain_text():
    """Test standard text edit replacement without superscripts."""
    print("\n--- RUNNING TEST 1: Plain Text Edit ---", flush=True)
    with tempfile.TemporaryDirectory() as tmp_dir:
        pdf_path = os.path.join(tmp_dir, "test.pdf")
        create_test_pdf_with_text(pdf_path, ["The quick brown fox jumps over the lazy dog."])
        
        doc = fitz.open(pdf_path)
        page = doc[0]
        text_page = page.get_text("dict")
        span = text_page["blocks"][0]["lines"][0]["spans"][0]
        rect = span["bbox"]
        origin_y = span["origin"][1]
        doc.close()
        
        edits = [{
            "pageNum": 1,
            "origStr": "The quick brown fox jumps over the lazy dog.",
            "newStr": "The fast brown fox jumps over the lazy dog.",
            "origin_y": origin_y,
            "rect": {"x": rect[0], "y": rect[1], "w": rect[2] - rect[0], "h": rect[3] - rect[1]},
            "origFontSize": 12,
            "fontSizeAdj": 0,
            "fontName": "Helvetica",
            "superscriptRanges": []
        }]
        
        with open(pdf_path, "rb") as f:
            resp = client.post(
                "/api/pdf/apply-edits",
                files={"file": ("test.pdf", f, "application/pdf")},
                data={"edits": json.dumps(edits)}
            )
            
        if resp.status_code != 200:
            print(f"FAILED status_code: {resp.status_code} {resp.text}", flush=True)
            return
            
        out_doc = fitz.open(stream=resp.content, filetype="pdf")
        out_text = out_doc[0].get_text()
        print(f"Extracted text raw:\n{repr(out_text)}", flush=True)
        out_doc.close()

def test_apply_edits_superscript_same_text():
    """Test editing a block to add a superscript when origStr == newStr."""
    print("\n--- RUNNING TEST 2: Superscript Same-Text Edit ---", flush=True)
    with tempfile.TemporaryDirectory() as tmp_dir:
        pdf_path = os.path.join(tmp_dir, "test_super.pdf")
        create_test_pdf_with_text(pdf_path, ["According to Einstein E=mc2 in relativity."])
        
        doc = fitz.open(pdf_path)
        page = doc[0]
        text_page = page.get_text("dict")
        span = text_page["blocks"][0]["lines"][0]["spans"][0]
        rect = span["bbox"]
        origin_y = span["origin"][1]
        doc.close()
        
        full_text = "According to Einstein E=mc2 in relativity."
        idx2 = full_text.index("2")
        
        edits = [{
            "pageNum": 1,
            "origStr": full_text,
            "newStr": full_text,
            "origin_y": origin_y,
            "rect": {"x": rect[0], "y": rect[1], "w": rect[2] - rect[0], "h": rect[3] - rect[1]},
            "origFontSize": 12,
            "fontSizeAdj": 0,
            "fontName": "Helvetica",
            "superscriptRanges": [{"kind": "super", "charStart": idx2, "charEnd": idx2 + 1}]
        }]
        
        with open(pdf_path, "rb") as f:
            resp = client.post(
                "/api/pdf/apply-edits",
                files={"file": ("test_super.pdf", f, "application/pdf")},
                data={"edits": json.dumps(edits)}
            )
            
        if resp.status_code != 200:
            print(f"FAILED status_code: {resp.status_code} {resp.text}", flush=True)
            return

        out_doc = fitz.open(stream=resp.content, filetype="pdf")
        out_dict = out_doc[0].get_text("dict")
        
        spans_info = []
        for block in out_dict.get("blocks", []):
            for line in block.get("lines", []):
                for s in line.get("spans", []):
                    spans_info.append((s["text"], s["origin"], s["size"]))
        out_doc.close()
        
        print(f"Spans info: {spans_info}", flush=True)
        super_span_found = False
        for text, origin, size in spans_info:
            if "2" in text and origin[1] < origin_y - 1 and size < 12:
                super_span_found = True
                break
        print(f"Superscript span found: {super_span_found}", flush=True)

def test_apply_edits_superscript_diff_text():
    """Test editing a block with text changes at end and superscript at beginning/middle."""
    print("\n--- RUNNING TEST 3: Superscript Diff-Text Edit ---", flush=True)
    with tempfile.TemporaryDirectory() as tmp_dir:
        pdf_path = os.path.join(tmp_dir, "test_super_diff.pdf")
        create_test_pdf_with_text(pdf_path, ["Reference 1 was cited here."])
        
        doc = fitz.open(pdf_path)
        page = doc[0]
        text_page = page.get_text("dict")
        span = text_page["blocks"][0]["lines"][0]["spans"][0]
        rect = span["bbox"]
        origin_y = span["origin"][1]
        doc.close()
        
        full_orig = "Reference 1 was cited here."
        full_new = "Reference 1 was cited here recently."
        idx1 = full_new.index("1")
        
        edits = [{
            "pageNum": 1,
            "origStr": full_orig,
            "newStr": full_new,
            "origin_y": origin_y,
            "rect": {"x": rect[0], "y": rect[1], "w": rect[2] - rect[0], "h": rect[3] - rect[1]},
            "origFontSize": 12,
            "fontSizeAdj": 0,
            "fontName": "Helvetica",
            "superscriptRanges": [{"kind": "super", "charStart": idx1, "charEnd": idx1 + 1}]
        }]
        
        with open(pdf_path, "rb") as f:
            resp = client.post(
                "/api/pdf/apply-edits",
                files={"file": ("test_super_diff.pdf", f, "application/pdf")},
                data={"edits": json.dumps(edits)}
            )
            
        if resp.status_code != 200:
            print(f"FAILED status_code: {resp.status_code} {resp.text}", flush=True)
            return

        out_doc = fitz.open(stream=resp.content, filetype="pdf")
        out_dict = out_doc[0].get_text("dict")
        
        spans_info = []
        for block in out_dict.get("blocks", []):
            for line in block.get("lines", []):
                for s in line.get("spans", []):
                    spans_info.append((s["text"], s["origin"], s["size"]))
        out_doc.close()
        
        print(f"Spans info: {spans_info}", flush=True)
        super_span_found = False
        for text, origin, size in spans_info:
            if "1" in text and origin[1] < origin_y - 1 and size < 12:
                super_span_found = True
                break
        print(f"Superscript span found: {super_span_found}", flush=True)

def test_apply_edits_paragraph_lines():
    """Test paragraph edit with lines array re-serialization."""
    print("\n--- RUNNING TEST 4: Paragraph Edit with Lines ---", flush=True)
    with tempfile.TemporaryDirectory() as tmp_dir:
        pdf_path = os.path.join(tmp_dir, "test_para.pdf")
        create_test_pdf_with_text(pdf_path, ["Line one of original paragraph.", "Line two of original paragraph."])
        
        doc = fitz.open(pdf_path)
        page = doc[0]
        text_page = page.get_text("dict")
        span0 = text_page["blocks"][0]["lines"][0]["spans"][0]
        rect = span0["bbox"]
        origin_y = span0["origin"][1]
        doc.close()
        
        edits = [{
            "pageNum": 1,
            "origStr": "Line one of original paragraph.",
            "newStr": "First line of paragraph edit.\nSecond line of paragraph edit.",
            "lines": ["First line of paragraph edit.", "Second line of paragraph edit."],
            "isParagraph": True,
            "origin_y": origin_y,
            "rect": {"x": rect[0], "y": rect[1], "w": 300, "h": 60},
            "origFontSize": 12,
            "fontSizeAdj": 0,
            "fontName": "Helvetica",
            "superscriptRanges": []
        }]
        
        with open(pdf_path, "rb") as f:
            resp = client.post(
                "/api/pdf/apply-edits",
                files={"file": ("test_para.pdf", f, "application/pdf")},
                data={"edits": json.dumps(edits)}
            )
            
        if resp.status_code != 200:
            print(f"FAILED status_code: {resp.status_code} {resp.text}", flush=True)
            return

        out_doc = fitz.open(stream=resp.content, filetype="pdf")
        out_text = out_doc[0].get_text()
        print(f"Extracted paragraph text raw:\n{repr(out_text)}", flush=True)
        out_doc.close()
        assert "First line of paragraph edit." in out_text
        print("Paragraph edit with lines passed successfully!", flush=True)

def test_extract_spacing_block_line_metrics():
    """Test extract-spacing returns blocks with line metrics (text, bbox, width, height, space_count)."""
    print("\n--- RUNNING TEST 5: Extract Spacing Block Line Metrics ---", flush=True)
    with tempfile.TemporaryDirectory() as tmp_dir:
        pdf_path = os.path.join(tmp_dir, "test_spacing.pdf")
        create_test_pdf_with_text(pdf_path, ["The quick brown fox", "jumps over the lazy dog."])

        with open(pdf_path, "rb") as f:
            resp = client.post(
                "/api/pdf/extract-spacing",
                files={"file": ("test_spacing.pdf", f, "application/pdf")}
            )

        if resp.status_code != 200:
            print(f"FAILED status_code: {resp.status_code} {resp.text}", flush=True)
            return

        data = resp.json()
        assert len(data) > 0, "Payload must contain at least one page"
        page_0 = data[0]
        assert "blocks" in page_0, "Page payload must contain blocks"
        blocks = page_0["blocks"]
        assert len(blocks) > 0, "Page must contain at least one block"

        found_line = False
        for b in blocks:
            for line in b.get("lines", []):
                assert "text" in line, "Line metric missing 'text'"
                assert "bbox" in line, "Line metric missing 'bbox'"
                assert "width" in line, "Line metric missing 'width'"
                assert "height" in line, "Line metric missing 'height'"
                assert "space_count" in line, "Line metric missing 'space_count'"
                assert round(line["width"], 3) == round(line["bbox"][2] - line["bbox"][0], 3)
                assert round(line["height"], 3) == round(line["bbox"][3] - line["bbox"][1], 3)
                assert line["space_count"] == line["text"].count(" ")
                found_line = True
                print(f"Verified line metric: text='{line['text']}', bbox={line['bbox']}, w={line['width']:.1f}, h={line['height']:.1f}, space_count={line['space_count']}", flush=True)

        assert found_line, "No lines found in extracted blocks"
        print("Extract spacing block line metrics test passed successfully!", flush=True)

if __name__ == "__main__":
    test_apply_edits_plain_text()
    test_apply_edits_superscript_same_text()
    test_apply_edits_superscript_diff_text()
    test_apply_edits_paragraph_lines()
    test_extract_spacing_block_line_metrics()


