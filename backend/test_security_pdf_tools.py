import os
import sys
import json
import tempfile
import fitz  # PyMuPDF
from pathlib import Path

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def create_sample_pdf(filepath):
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((50, 100), "CONFIDENTIAL DOCUMENT", fontsize=18, color=(1, 0, 0))
    page.insert_text((50, 140), "This is a secret document containing sensitive text like SSN 123-45-6789.", fontsize=12)
    page.draw_rect(fitz.Rect(50, 200, 300, 300), color=(0, 0, 1), fill=(0.9, 0.9, 1))
    doc.save(filepath)
    doc.close()

def test_lock_and_unlock_pdf():
    with tempfile.TemporaryDirectory() as tmp_dir:
        input_pdf = os.path.join(tmp_dir, "sample.pdf")
        create_sample_pdf(input_pdf)

        # 1. Test Lock PDF (with allow_print=false and allow_copy=false)
        with open(input_pdf, "rb") as f:
            resp = client.post(
                "/api/convert/lock-pdf",
                files={"file": ("sample.pdf", f, "application/pdf")},
                data={"password": "SecretPassword123", "allow_print": "false", "allow_copy": "false"}
            )
        assert resp.status_code == 202, f"Lock PDF failed with status {resp.status_code}: {resp.text}"
        data = resp.json()
        job_id = data["job_id"]
        print(f"[TEST] Lock PDF job submitted: {job_id}")

        # Wait for job completion
        import time
        for _ in range(20):
            res_resp = client.get(f"/api/jobs/{job_id}/status")
            if res_resp.json().get("status") == "done":
                break
            time.sleep(0.2)

        res = client.get(f"/api/jobs/{job_id}/status").json()
        assert res.get("status") == "done", f"Lock PDF job not done: {res}"

        # Download locked PDF result
        download_resp = client.get(f"/api/jobs/{job_id}/download")
        assert download_resp.status_code == 200
        locked_pdf_bytes = download_resp.content

        # Verify PyMuPDF recognizes it as encrypted
        locked_doc = fitz.open(stream=locked_pdf_bytes, filetype="pdf")
        assert locked_doc.is_encrypted, "Locked PDF should be encrypted!"
        auth_success = locked_doc.authenticate("SecretPassword123")
        assert auth_success > 0, "Failed to authenticate locked PDF with password!"
        locked_doc.close()
        print("[TEST] Lock PDF verification passed successfully!")

        # 2. Test Unlock PDF
        resp_unlock = client.post(
            "/api/convert/unlock-pdf",
            files={"file": ("locked_sample.pdf", locked_pdf_bytes, "application/pdf")},
            data={"password": "SecretPassword123"}
        )
        assert resp_unlock.status_code == 202
        unlock_job_id = resp_unlock.json()["job_id"]

        for _ in range(20):
            res_resp = client.get(f"/api/jobs/{unlock_job_id}/status")
            if res_resp.json().get("status") == "done":
                break
            time.sleep(0.2)

        res_unlock = client.get(f"/api/jobs/{unlock_job_id}/status").json()
        assert res_unlock.get("status") == "done", f"Unlock PDF job not done: {res_unlock}"

        unlocked_bytes = client.get(f"/api/jobs/{unlock_job_id}/download").content
        unlocked_doc = fitz.open(stream=unlocked_bytes, filetype="pdf")
        assert not unlocked_doc.is_encrypted, "Unlocked PDF should not be encrypted!"
        text = unlocked_doc[0].get_text()
        assert "CONFIDENTIAL" in text, "Unlocked PDF text should be readable!"
        unlocked_doc.close()
        print("[TEST] Unlock PDF verification passed successfully!")

def test_redact_pdf():
    with tempfile.TemporaryDirectory() as tmp_dir:
        input_pdf = os.path.join(tmp_dir, "sample.pdf")
        create_sample_pdf(input_pdf)

        redactions_payload = json.dumps({
            "items": [
                {"page": 0, "type": "text", "text": "SSN 123-45-6789", "color": "#000000"},
                {"page": 0, "type": "rect", "rect": [40, 680, 320, 720], "color": "#000000"}
            ]
        })

        with open(input_pdf, "rb") as f:
            resp = client.post(
                "/api/convert/redact-pdf",
                files={"file": ("sample.pdf", f, "application/pdf")},
                data={"redactions": redactions_payload}
            )
        assert resp.status_code == 202
        job_id = resp.json()["job_id"]

        import time
        for _ in range(20):
            res_resp = client.get(f"/api/jobs/{job_id}/status")
            if res_resp.json().get("status") == "done":
                break
            time.sleep(0.2)

        res = client.get(f"/api/jobs/{job_id}/status").json()
        assert res.get("status") == "done", f"Redact PDF job not done: {res}"

        redacted_bytes = client.get(f"/api/jobs/{job_id}/download").content
        redacted_doc = fitz.open(stream=redacted_bytes, filetype="pdf")
        text = redacted_doc[0].get_text()
        assert "123-45-6789" not in text, "Redacted text should be purged from PDF!"
        redacted_doc.close()
        print("[TEST] Redact PDF verification passed successfully!")

if __name__ == "__main__":
    test_lock_and_unlock_pdf()
    test_redact_pdf()
    print("[TEST SUCCESS] All 3 PDF security tools verified end-to-end!")
