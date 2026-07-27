"""
Test script for PDF Comparison Engine endpoint /api/convert/compare-pdf
"""
import os
import sys
import tempfile
import time
import fitz
from fastapi.testclient import TestClient

# Add parent directory to sys.path to allow imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app


def create_test_pdfs():
    """Create two sample PDFs with known differences."""
    tmp_dir = tempfile.mkdtemp()
    path1 = os.path.join(tmp_dir, "doc1.pdf")
    path2 = os.path.join(tmp_dir, "doc2.pdf")

    # Document 1 (Original)
    doc1 = fitz.open()
    page1 = doc1.new_page(width=612, height=792)
    page1.insert_text((50, 100), "Document Header Version 1.0", fontsize=14)
    page1.insert_text((50, 140), "This section contains original content that will be compared.", fontsize=11)
    page1.insert_text((50, 180), "This line is going to be deleted in the next version.", fontsize=11)
    page1.insert_text((50, 220), "Final conclusion line of document.", fontsize=11)
    doc1.save(path1)
    doc1.close()

    # Document 2 (Modified)
    doc2 = fitz.open()
    page2 = doc2.new_page(width=612, height=792)
    page2.insert_text((50, 100), "Document Header Version 2.0", fontsize=14) # Modification
    page2.insert_text((50, 140), "This section contains original content that will be compared.", fontsize=11)
    page2.insert_text((50, 180), "This is a brand new line inserted in version 2.0.", fontsize=11) # Addition
    page2.insert_text((50, 220), "Final conclusion line of document.", fontsize=11)
    doc2.save(path2)
    doc2.close()

    return path1, path2, tmp_dir


def main():
    print("Creating test PDF files...")
    path1, path2, tmp_dir = create_test_pdfs()

    client = TestClient(app)

    print("Submitting PDF comparison job to /api/convert/compare-pdf...")
    with open(path1, "rb") as f1, open(path2, "rb") as f2:
        files = [
            ("files", ("doc1.pdf", f1, "application/pdf")),
            ("files", ("doc2.pdf", f2, "application/pdf")),
        ]
        response = client.post("/api/convert/compare-pdf", files=files)

    print(f"Submission status code: {response.status_code}")
    assert response.status_code == 202, f"Expected 202, got {response.status_code}: {response.text}"

    data = response.json()
    job_id = data["job_id"]
    print(f"Job submitted successfully. Job ID: {job_id}")

    # Poll status
    max_retries = 15
    status_data = None
    for attempt in range(max_retries):
        time.sleep(0.5)
        status_res = client.get(f"/api/jobs/{job_id}/status")
        assert status_res.status_code == 200, f"Status poll failed: {status_res.text}"
        status_data = status_res.json()
        print(f"Attempt {attempt+1}: Status = {status_data.get('status')}")
        if status_data.get("status") in ("done", "error"):
            break

    assert status_data.get("status") == "done", f"Job failed with error: {status_data.get('error')}"

    comp_data = status_data.get("comparison_data")
    assert comp_data is not None, "comparison_data missing from status response!"
    print("\n--- Comparison Data Result ---")
    print(f"Total Changes: {comp_data.get('change_count')}")
    print(f"Additions Count: {comp_data.get('additions_count')}")
    print(f"Deletions Count: {comp_data.get('deletions_count')}")
    print(f"Modifications Count: {comp_data.get('modifications_count')}")
    print(f"Changes detail count: {len(comp_data.get('changes', []))}")

    for idx, c in enumerate(comp_data.get("changes", []), 1):
        print(f"  [{idx}] Type: {c['type']}, Page1: {c['page1']}, Page2: {c['page2']}")
        print(f"      Old Text: {repr(c['old_text'])}")
        print(f"      New Text: {repr(c['new_text'])}")
        print(f"      BBox1: {c['bbox1']}, BBox2: {c['bbox2']}")

    # Download report PDF
    download_res = client.get(f"/api/jobs/{job_id}/download")
    assert download_res.status_code == 200, f"Download failed: {download_res.status_code}"
    pdf_bytes = download_res.content
    print(f"\nReport PDF downloaded successfully ({len(pdf_bytes)} bytes).")

    report_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    print(f"Report PDF total pages: {len(report_doc)}")
    assert len(report_doc) >= 2, f"Expected at least 2 pages in report (Summary + Diff page), got {len(report_doc)}"
    report_doc.close()

    print("\nSUCCESS! PDF comparison engine backend test passed flawlessly.")


if __name__ == "__main__":
    main()
