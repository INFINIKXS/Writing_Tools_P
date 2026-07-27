"""
Audit: edge cases for apply_italic_formatting across all citation styles.
Tests journal patterns that might fall through to the book/report default.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from citations.formatting import apply_italic_formatting

cases = [
    # ── JOURNAL EDGE CASES ──────────────────────────────────────────────
    # 1. Article number instead of pages (common in PLOS, BMJ Open, etc.)
    ("APA journal with article number (e-locator)",
     "Smith, J. (2020). Title of article. Journal of Something, 12, e12345. https://doi.org/10.1234/5678",
     "Journal of Something"),

    # 2. Volume only, no issue, no pages (already fixed)
    ("Harvard vol-only",
     "Babaii, A. (2021) 'Title here', Journal of Patient Experience, 8. doi: https://doi.org/10.1177/123",
     "Journal of Patient Experience"),

    # 3. Journal with volume, issue, but article number instead of pages
    ("APA journal vol+issue+article number",
     "Lee, R. (2019). Some title. BMJ Open, 9(3), e025432. https://doi.org/10.1136/bmjopen",
     "BMJ Open"),

    # 4. Journal with just pages, no volume (rare but exists in older refs)
    ("Harvard journal pages only",
     "Jones, A. (2018) 'Old article title', Historical Review, pp. 45-67.",
     "Historical Review"),

    # 5. Vancouver style (numbered, no quotes, abbreviated journal)
    ("Vancouver numbered",
     "1. Smith J, Jones A. Title of article. J Clin Med. 2020;15(3):245-252.",
     "J Clin Med"),

    # 6. Vancouver with volume only, no issue
    ("Vancouver vol-only no issue",
     "2. Brown K. Article title. Lancet Digit Health. 2021;4:100-108.",
     "Lancet Digit Health"),

    # 7. Harvard with 'Available at:' URL ending
    ("Harvard with Available at",
     "Clark, D. (2020) 'Web article title', The Guardian, 15 March. Available at: https://www.theguardian.com/article",
     None),  # This is a newspaper — tricky

    # 8. Journal with supplement notation
    ("APA journal with supplement",
     "White, P. (2019). Title here. American Journal of Medicine, 132(Suppl 1), S45-S52.",
     "American Journal of Medicine"),

    # 9. Journal with no DOI, ends with page range period
    ("APA journal ending with pages",
     "Davis, M. (2018). Some article. Nursing Research, 67(4), 312-320.",
     "Nursing Research"),

    # 10. Online-only journal with no volume/issue/pages at all
    ("APA online-only no vol/issue/pages",
     "Green, T. (2022). Article title. First Monday. https://doi.org/10.5210/fm.v27i1.12345",
     "First Monday"),

    # 11. Harvard single-word journal
    ("Harvard single-word journal",
     "Adams, S. (2020) 'Title of work', Nature, 580(7804), pp. 455-460.",
     "Nature"),

    # 12. Advance online publication
    ("APA advance online",
     "Kim, Y. (2023). New findings. Journal of Advanced Nursing. Advance online publication. https://doi.org/10.1111/jan.15678",
     "Journal of Advanced Nursing"),

    # 13. Journal with very long name
    ("APA long journal name",
     "Patel, R. (2021). Article title. International Journal of Environmental Research and Public Health, 18(12), 6543.",
     "International Journal of Environmental Research and Public Health"),

    # ── BOOK/NON-JOURNAL (should NOT be mis-italicised) ─────────────────
    # 14. Standard book
    ("APA book",
     "Smith, J. (2020). Book title. Publisher.",
     "Book title"),

    # 15. Edited book chapter
    ("APA edited chapter",
     "Brown, A. (2019). Chapter title. In J. Editor (Ed.), Book title (pp. 100-120). Publisher.",
     "Book title"),

    # 16. Webpage with no volume info
    ("APA webpage",
     "World Health Organization. (2021). COVID-19 guidelines. World Health Organization. https://www.who.int/guidelines",
     None),  # online periodical rule or book rule

    # 17. Report
    ("APA report",
     "National Institute for Health. (2020). Annual report on health outcomes. Government Publishing Office.",
     "Annual report on health outcomes"),

    # 18. Harvard book
    ("Harvard book",
     "Taylor, M. (2019) Understanding nursing research. 7th edn. Elsevier.",
     "Understanding nursing research"),
]

print("=" * 100)
print("ITALIC FORMATTING AUDIT")
print("=" * 100)

issues = []
for label, ref_in, expected_italic in cases:
    result = apply_italic_formatting(ref_in)
    
    # Check what got italicised
    import re
    italic_match = re.search(r'<i>(.*?)</i>', result)
    actual_italic = italic_match.group(1) if italic_match else None
    
    # Determine pass/fail
    if expected_italic is None:
        status = "INFO"  # We just want to see what happens
    elif actual_italic and expected_italic in actual_italic and len(actual_italic) < len(expected_italic) * 2:
        status = "PASS"
    elif actual_italic == expected_italic:
        status = "PASS"
    else:
        status = "FAIL"
        issues.append(label)
    
    marker = {"PASS": "OK", "FAIL": "XX", "INFO": "??"}[status]
    print(f"\n{marker} [{status}] {label}")
    print(f"  IN:       {ref_in}")
    print(f"  OUT:      {result}")
    print(f"  ITALIC:   {actual_italic}")
    if expected_italic is not None:
        print(f"  EXPECTED: {expected_italic}")

print("\n" + "=" * 100)
if issues:
    print(f"ISSUES FOUND ({len(issues)}):")
    for i in issues:
        print(f"  ✗ {i}")
else:
    print("ALL CHECKS PASSED")
print("=" * 100)
