import os
import sys
sys.path.insert(0, '.')
from utils.text_extraction import extract_docx_text

root_dir = r"C:\Users\Paradox-Labs\Documents\MY RESEARCH\my writiing"
for r, d, fs in os.walk(root_dir):
    for f in fs:
        if f.lower().endswith('.docx') and not f.startswith('~$'):
            full_path = os.path.join(r, f)
            try:
                with open(full_path, 'rb') as doc_f:
                    text = extract_docx_text(doc_f.read())
                    if 'Prescott' in text:
                        print(f"MATCH: {full_path}")
            except Exception as e:
                # print(f"Error reading {full_path}: {e}")
                pass
