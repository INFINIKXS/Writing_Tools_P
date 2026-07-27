import fitz
import os

pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "188.pdf"))
doc = fitz.open(pdf_path)

print(f"Total pages: {len(doc)}", flush=True)

for i in range(len(doc)):
    page = doc[i]
    lines = page.get_text().split("\n")
    # Clean empty lines
    lines = [line.strip() for line in lines if line.strip()]
    
    print(f"\n--- Page {i+1} ---", flush=True)
    print("Top 3 lines:", flush=True)
    for line in lines[:3]:
        print(f"  [TOP] {repr(line)}", flush=True)
    print("Bottom 3 lines:", flush=True)
    for line in lines[-3:]:
        print(f"  [BOT] {repr(line)}", flush=True)
