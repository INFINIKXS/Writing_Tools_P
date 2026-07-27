import time
import io
import fitz
from PIL import Image
from fastapi import FastAPI
from fastapi.testclient import TestClient
from converter import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)

def create_sample_pdf():
    doc = fitz.open()
    for i in range(3):
        page = doc.new_page(width=612, height=792)
        page.insert_text((100, 100), f"Sample Page {i+1}", fontsize=20)
    pdf_bytes = io.BytesIO()
    doc.save(pdf_bytes)
    doc.close()
    return pdf_bytes.getvalue()

def create_sample_image():
    img = Image.new("RGBA", (200, 200), (0, 128, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def test_text_watermark():
    print("--- Testing Text Watermark ---")
    pdf_bytes = create_sample_pdf()
    files = {"file": ("test.pdf", pdf_bytes, "application/pdf")}
    data = {
        "watermark_type": "text",
        "text": "DRAFT COPY",
        "font_family": "Helvetica",
        "font_size": "40",
        "bold": "true",
        "italic": "true",
        "color": "#00FF00",
        "position": "mosaic",
        "opacity": "0.6",
        "rotation": "45",
        "from_page": "1",
        "to_page": "2",
        "layer": "over"
    }
    response = client.post("/api/convert/add-watermark", files=files, data=data)
    assert response.status_code == 202, f"Status code failed: {response.status_code}"
    job_id = response.json()["job_id"]
    print("Submitted text watermark job:", job_id)

    status = "pending"
    for _ in range(50):
        time.sleep(0.2)
        res = client.get(f"/api/convert/job-status/{job_id}")
        if res.status_code == 200:
            status = res.json().get("status")
            if status in ["done", "error"]:
                if status == "error":
                    print("Error detail:", res.json().get("error"))
                break
    
    assert status == "done", f"Job failed with status: {status}"
    print("Text watermark job completed successfully!")

def test_image_watermark():
    print("--- Testing Image Watermark ---")
    pdf_bytes = create_sample_pdf()
    img_bytes = create_sample_image()
    files = {
        "file": ("test.pdf", pdf_bytes, "application/pdf"),
        "image_file": ("watermark.png", img_bytes, "image/png")
    }
    data = {
        "watermark_type": "image",
        "position": "center",
        "opacity": "0.5",
        "rotation": "30",
        "from_page": "1",
        "to_page": "0",
        "layer": "over"
    }
    response = client.post("/api/convert/add-watermark", files=files, data=data)
    assert response.status_code == 202, f"Status code failed: {response.status_code}"
    job_id = response.json()["job_id"]
    print("Submitted image watermark job:", job_id)

    status = "pending"
    for _ in range(50):
        time.sleep(0.2)
        res = client.get(f"/api/convert/job-status/{job_id}")
        if res.status_code == 200:
            status = res.json().get("status")
            if status in ["done", "error"]:
                if status == "error":
                    print("Error detail:", res.json().get("error"))
                break
    
    assert status == "done", f"Job failed with status: {status}"
    print("Image watermark job completed successfully!")

def test_text_watermark_scale():
    print("--- Testing Text Watermark with Scale ---")
    pdf_bytes = create_sample_pdf()
    files = {"file": ("test.pdf", pdf_bytes, "application/pdf")}
    data = {
        "watermark_type": "text",
        "text": "SCALED WATERMARK",
        "font_family": "Helvetica",
        "font_size": "36",
        "scale": "1.5",
        "color": "#FF0000",
        "position": "center",
        "opacity": "0.5",
        "rotation": "45"
    }
    response = client.post("/api/convert/add-watermark", files=files, data=data)
    assert response.status_code == 202, f"Status code failed: {response.status_code}"
    job_id = response.json()["job_id"]
    print("Submitted scaled text watermark job:", job_id)

    status = "pending"
    for _ in range(50):
        time.sleep(0.2)
        res = client.get(f"/api/convert/job-status/{job_id}")
        if res.status_code == 200:
            status = res.json().get("status")
            if status in ["done", "error"]:
                if status == "error":
                    print("Error detail:", res.json().get("error"))
                break
    
    assert status == "done", f"Scaled text watermark job failed with status: {status}"
    print("Scaled text watermark job completed successfully!")

def test_image_watermark_scale():
    print("--- Testing Image Watermark with Scale ---")
    pdf_bytes = create_sample_pdf()
    img_bytes = create_sample_image()
    files = {
        "file": ("test.pdf", pdf_bytes, "application/pdf"),
        "image_file": ("watermark.png", img_bytes, "image/png")
    }
    data = {
        "watermark_type": "image",
        "position": "center",
        "scale": "2.0",
        "opacity": "0.5",
        "rotation": "0"
    }
    response = client.post("/api/convert/add-watermark", files=files, data=data)
    assert response.status_code == 202, f"Status code failed: {response.status_code}"
    job_id = response.json()["job_id"]
    print("Submitted scaled image watermark job:", job_id)

    status = "pending"
    for _ in range(30):
        time.sleep(0.2)
        res = client.get(f"/api/convert/job-status/{job_id}")
        if res.status_code == 200:
            status = res.json().get("status")
            if status in ["done", "error"]:
                if status == "error":
                    print("Error detail:", res.json().get("error"))
                break
    
    assert status == "done", f"Scaled image watermark job failed with status: {status}"
    print("Scaled image watermark job completed successfully!")

if __name__ == "__main__":
    test_text_watermark()
    test_image_watermark()
    test_text_watermark_scale()
    test_image_watermark_scale()
    print("ALL WATERMARK TESTS PASSED SUCCESSFULLY!")
