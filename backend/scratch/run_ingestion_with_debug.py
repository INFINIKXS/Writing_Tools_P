import os
import sys
import io
import asyncio
import logging

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Configure logger to output warnings to stdout so we see them
logging.basicConfig(level=logging.WARNING, format='[%(levelname)s] %(message)s')

import moldbank_store
from PyPDF2 import PdfReader

pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "188.pdf"))
print(f"Running LLM ingestion on: {pdf_path}")

with open(pdf_path, "rb") as f:
    file_bytes = f.read()

reader = PdfReader(io.BytesIO(file_bytes))
pages_text = []
for page in reader.pages:
    pages_text.append(page.extract_text() or "")

async def main():
    meta = {
        "source_title": "188.pdf",
        "source_author": "VS Raleigh et al.",
        "publication_year": 2010,
        "domain": "medicine",
        "peer_reviewed": True
    }
    result = await moldbank_store.index_document("188.pdf", pages_text, meta)
    print(f"\nIngestion Result: {result}")

asyncio.run(main())
