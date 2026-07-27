"""Quick test: does extraction catch (Prescott and Angus, 2018)?"""
import sys
sys.path.insert(0, '.')
from citations.extraction import extract_citations_regex

text = (
    "Finally, healthcare organisations need to create structured post-sepsis "
    "recovery pathways that go beyond hospital discharge. Survivors of sepsis "
    "are often left with ongoing physical, cognitive and psychological "
    "impairment that may lead to functional decline, poor quality of life "
    "and readmission to hospital (Prescott and Angus, 2018)."
)

results = extract_citations_regex(text)
print(f"Found {len(results)} citation(s):")
for r in results:
    print(f"  text={r['text']!r}  type={r['type']}")

if not results:
    print("\n*** BUG: (Prescott and Angus, 2018) was NOT extracted! ***")
else:
    print("\n*** OK: citation extracted successfully ***")
