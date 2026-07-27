import os
import sys
import tempfile
import zipfile
import shutil
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from converter import (
    _run_pdf_to_images_sync,
    _run_compress_image_sync,
    _run_split_pdf_sync,
    _job_store,
    JobStatus,
)
from PIL import Image

def test_pdf_to_images_flat_zip():
    print("--- Testing _run_pdf_to_images_sync ---")
    tmp_dir = tempfile.mkdtemp()
    try:
        # Create mock image bytes to simulate pdf conversion if pdf2image / poppler mock is needed
        # Or test logic directly by mocking convert_from_bytes or passing real dummy PDF if poppler is available.
        # Let's mock convert_from_bytes in converter module to test pure ZIP output logic reliably.
        import converter
        original_convert = getattr(converter, "convert_from_bytes", None)

        def mock_convert_from_bytes(file_bytes, dpi=200, fmt="jpeg", poppler_path=None):
            # Create a 10x10 test PIL image
            img = Image.new("RGB", (10, 10), color="red")
            return [img, img]  # 2 pages

        converter.convert_from_bytes = mock_convert_from_bytes

        # Create dummy PDF files
        pdf1 = os.path.join(tmp_dir, "test1.pdf")
        pdf2 = os.path.join(tmp_dir, "test2.pdf")
        with open(pdf1, "wb") as f:
            f.write(b"%PDF-mock")
        with open(pdf2, "wb") as f:
            f.write(b"%PDF-mock")

        # Test case 1: Multiple PDFs with SAME stem "doc" (collision test)
        job_id = "job_test_collision"
        _job_store[job_id] = {}
        in_paths = [pdf1, pdf2]
        stems = ["doc", "doc"]

        _run_pdf_to_images_sync(job_id, in_paths, tmp_dir, stems)

        assert _job_store[job_id]["status"] == JobStatus.DONE, f"Job failed: {_job_store[job_id].get('error')}"
        zip_path = _job_store[job_id]["result_path"]
        assert os.path.exists(zip_path), "ZIP output file does not exist!"

        with zipfile.ZipFile(zip_path, "r") as zf:
            namelist = zf.namelist()
            print("ZIP Namelist (same stem collision):", namelist)
            for name in namelist:
                assert "/" not in name, f"Found slash in entry: {name}"
                assert "\\" not in name, f"Found backslash in entry: {name}"

            # Check expected flat names and collision resolution
            expected = ["doc_page_1.jpg", "doc_page_2.jpg", "doc_page_1_1.jpg", "doc_page_2_1.jpg"]
            assert set(namelist) == set(expected), f"Mismatch in ZIP contents. Got {namelist}, expected {expected}"

        # Test case 2: Multiple PDFs with different stems
        job_id_diff = "job_test_diff_stems"
        _job_store[job_id_diff] = {}
        stems_diff = ["report_a", "report_b"]

        _run_pdf_to_images_sync(job_id_diff, in_paths, tmp_dir, stems_diff)

        assert _job_store[job_id_diff]["status"] == JobStatus.DONE
        zip_path_diff = _job_store[job_id_diff]["result_path"]
        with zipfile.ZipFile(zip_path_diff, "r") as zf:
            namelist_diff = zf.namelist()
            print("ZIP Namelist (different stems):", namelist_diff)
            for name in namelist_diff:
                assert "/" not in name, f"Found slash in entry: {name}"
                assert "\\" not in name, f"Found backslash in entry: {name}"

            expected_diff = ["report_a_page_1.jpg", "report_a_page_2.jpg", "report_b_page_1.jpg", "report_b_page_2.jpg"]
            assert set(namelist_diff) == set(expected_diff), f"Mismatch in ZIP contents. Got {namelist_diff}, expected {expected_diff}"

        if original_convert:
            converter.convert_from_bytes = original_convert

        print("PASSED: _run_pdf_to_images_sync flat ZIP test!")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

def test_compress_image_flat_zip():
    print("--- Testing _run_compress_image_sync ---")
    tmp_dir = tempfile.mkdtemp()
    try:
        # Create test images
        img1_path = os.path.join(tmp_dir, "img.jpg")
        img2_path = os.path.join(tmp_dir, "img_copy.jpg")
        img1 = Image.new("RGB", (20, 20), color="blue")
        img1.save(img1_path)
        img1.save(img2_path)

        job_id = "job_compress_img"
        _job_store[job_id] = {}

        _run_compress_image_sync(
            job_id,
            [img1_path, img2_path],
            tmp_dir,
            quality=80,
            target_format="jpg"
        )

        assert _job_store[job_id]["status"] == JobStatus.DONE, f"Job failed: {_job_store[job_id].get('error')}"
        zip_path = _job_store[job_id]["result_path"]

        with zipfile.ZipFile(zip_path, "r") as zf:
            namelist = zf.namelist()
            print("ZIP Namelist (compress image):", namelist)
            for name in namelist:
                assert "/" not in name, f"Found slash in entry: {name}"
                assert "\\" not in name, f"Found backslash in entry: {name}"

        print("PASSED: _run_compress_image_sync flat ZIP test!")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

if __name__ == "__main__":
    test_pdf_to_images_flat_zip()
    test_compress_image_flat_zip()
    print("\nALL FLAT ZIP VERIFICATION TESTS PASSED SUCCESSFULLY!")
