import pypdf
import fitz
from PyPDF2 import PdfReader as PyPDF2Reader
import os

pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "188.pdf"))

reader_pypdf = pypdf.PdfReader(pdf_path)
text_pypdf = reader_pypdf.pages[0].extract_text()

reader_pypdf2 = PyPDF2Reader(pdf_path)
text_pypdf2 = reader_pypdf2.pages[0].extract_text()

doc_mupdf = fitz.open(pdf_path)
text_mupdf = doc_mupdf[0].get_text()

with open("pypdf_text.txt", "w", encoding="utf-8") as f:
    f.write(text_pypdf)
with open("pypdf2_text.txt", "w", encoding="utf-8") as f:
    f.write(text_pypdf2)
with open("mupdf_text.txt", "w", encoding="utf-8") as f:
    f.write(text_mupdf)

print("Files written. Let's check word counts of Page 1:")
print(f"pypdf: {len(text_pypdf.split())} words")
print(f"PyPDF2: {len(text_pypdf2.split())} words")
print(f"PyMuPDF: {len(text_mupdf.split())} words")
