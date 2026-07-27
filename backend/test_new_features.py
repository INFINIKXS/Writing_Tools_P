import os
import sys
import tempfile
import fitz

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.converter import (
    _run_rotate_pdf_sync,
    _run_pdf_to_pdfa_sync,
    _run_ocr_to_word_sync,
    _run_pdf_to_markdown_sync,
    _job_store,
    JobStatus
)

def test_rotate_pdf_per_page():
    print("Testing Per-Page PDF Rotation...")
    tmp_dir = tempfile.mkdtemp()
    test_pdf = os.path.join(tmp_dir, "test.pdf")
    doc = fitz.open()
    for i in range(3):
        p = doc.new_page()
        p.insert_text((50, 50), f"Page {i+1}")
    doc.save(test_pdf)
    doc.close()

    job_id = "test_rotate_job"
    _job_store[job_id] = {"status": JobStatus.PENDING, "result_path": None, "error": None}
    
    rotations_json = '{"1": 90, "2": 180, "3": 270}'
    _run_rotate_pdf_sync(job_id, test_pdf, tmp_dir, "test", 90, "all", rotations_json)

    assert _job_store[job_id]["status"] == JobStatus.DONE, f"Job failed: {_job_store[job_id].get('error')}"
    res_path = _job_store[job_id]["result_path"]
    assert os.path.exists(res_path), "Rotated PDF does not exist"

    res_doc = fitz.open(res_path)
    assert res_doc[0].rotation == 90, f"Expected page 1 rotation 90, got {res_doc[0].rotation}"
    assert res_doc[1].rotation == 180, f"Expected page 2 rotation 180, got {res_doc[1].rotation}"
    assert res_doc[2].rotation == 270, f"Expected page 3 rotation 270, got {res_doc[2].rotation}"
    res_doc.close()
    print("  [SUCCESS] Per-page PDF rotation verified successfully!")

def test_pdf_to_markdown():
    print("Testing PDF to Markdown Conversion...")
    tmp_dir = tempfile.mkdtemp()
    test_pdf = os.path.join(tmp_dir, "test_md.pdf")
    doc = fitz.open()
    p = doc.new_page()
    p.insert_text((50, 50), "Document Title", fontsize=24)
    p.insert_text((50, 100), "This is a paragraph test for markdown export.", fontsize=11)
    doc.save(test_pdf)
    doc.close()

    job_id = "test_md_job"
    _job_store[job_id] = {"status": JobStatus.PENDING, "result_path": None, "error": None}

    _run_pdf_to_markdown_sync(job_id, test_pdf, tmp_dir, "test_md")

    assert _job_store[job_id]["status"] == JobStatus.DONE, f"Job failed: {_job_store[job_id].get('error')}"
    res_path = _job_store[job_id]["result_path"]
    assert os.path.exists(res_path), "Markdown output file does not exist"

    with open(res_path, 'r', encoding='utf-8') as f:
        content = f.read()
    assert len(content) > 0, "Markdown output is empty"
    print("  [SUCCESS] PDF to Markdown conversion verified successfully!")

def test_ocr_to_word():
    print("Testing OCR to Word Document Conversion...")
    tmp_dir = tempfile.mkdtemp()
    test_pdf = os.path.join(tmp_dir, "test_ocr.pdf")
    doc = fitz.open()
    p = doc.new_page()
    p.insert_text((50, 50), "Sample OCR Document Text", fontsize=16)
    doc.save(test_pdf)
    doc.close()

    job_id = "test_ocr_job"
    _job_store[job_id] = {"status": JobStatus.PENDING, "result_path": None, "error": None}

    _run_ocr_to_word_sync(job_id, test_pdf, tmp_dir, "test_ocr", "eng")

    assert _job_store[job_id]["status"] == JobStatus.DONE, f"Job failed: {_job_store[job_id].get('error')}"
    res_path = _job_store[job_id]["result_path"]
    assert os.path.exists(res_path), "OCR .docx output does not exist"
    print("  [SUCCESS] OCR to Word conversion verified successfully!")

if __name__ == "__main__":
    print("--- Running Backend Automated Verification E2E Tests ---")
    test_rotate_pdf_per_page()
    test_pdf_to_markdown()
    test_ocr_to_word()
    print("--- ALL BACKEND E2E TESTS PASSED ---")
