import os, tempfile, uuid
import fitz
from PIL import Image
from converter import _run_add_watermark_sync, _job_store, JobStatus

def test_watermark_engine():
    tmp = tempfile.mkdtemp()
    pdf_path = os.path.join(tmp, "input.pdf")
    doc = fitz.open()
    doc.new_page(width=612, height=792)
    doc.new_page(width=612, height=792)
    doc.save(pdf_path)
    doc.close()

    # 1. Test text watermark (mosaic, rotated, colored)
    job_id_1 = str(uuid.uuid4())
    _job_store[job_id_1] = {"status": JobStatus.PENDING, "result_path": None, "tmp_dir": tmp, "filename": "out1.pdf", "content_type": "application/pdf", "error": None}
    _run_add_watermark_sync(
        job_id_1, pdf_path, tmp, "input",
        watermark_type="text", text="CONFIDENTIAL TEST",
        font_family="Helvetica", font_size=36, bold=True, italic=False,
        color="#FF0000", position="mosaic", opacity=0.5, rotation=45,
        from_page=1, to_page=2, layer="over"
    )
    print("Text WM status:", _job_store[job_id_1]["status"])
    if _job_store[job_id_1]["error"]:
        print("Text WM Error:", _job_store[job_id_1]["error"])
    assert _job_store[job_id_1]["status"] == JobStatus.DONE

    # Verify watermarked PDF is valid
    wm_doc1 = fitz.open(_job_store[job_id_1]["result_path"])
    assert len(wm_doc1) == 2
    wm_doc1.close()

    # 2. Test image watermark (center position, opacity, rotation)
    img_path = os.path.join(tmp, "logo.png")
    img = Image.new("RGBA", (100, 100), (0, 0, 255, 255))
    img.save(img_path)

    job_id_2 = str(uuid.uuid4())
    _job_store[job_id_2] = {"status": JobStatus.PENDING, "result_path": None, "tmp_dir": tmp, "filename": "out2.pdf", "content_type": "application/pdf", "error": None}
    _run_add_watermark_sync(
        job_id_2, pdf_path, tmp, "input",
        watermark_type="image", text="", image_path=img_path,
        position="center", opacity=0.4, rotation=30,
        from_page=1, to_page=0, layer="over"
    )
    print("Image WM status:", _job_store[job_id_2]["status"])
    if _job_store[job_id_2]["error"]:
        print("Image WM Error:", _job_store[job_id_2]["error"])
    assert _job_store[job_id_2]["status"] == JobStatus.DONE

    wm_doc2 = fitz.open(_job_store[job_id_2]["result_path"])
    assert len(wm_doc2) == 2
    wm_doc2.close()

    print("ALL BACKEND WATERMARK ENGINE DIRECT TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_watermark_engine()
