import unittest
import types
import fitz
from pdf_routes.editor import _heal_rect_splits, _should_merge, _merge_blocks, _detect_align_from_lines, _collect_enclosing_rects

class TestHealRectSplits(unittest.TestCase):
    def test_should_merge_valid_overflow(self):
        parent_rect = {
            "paragraph_id": "p_0_0",
            "block_number": 0,
            "font_size": 10.0,
            "font_family": "TimesNewRoman",
            "bbox": [50.0, 100.0, 300.0, 150.0],
            "pdfX": 50.0,
            "pdfY_top": 100.0,
            "pdfW": 250.0,
            "pdfH": 50.0,
            "region_kind": "rect",
            "text": "This is line one.\nThis is line two.",
            "line_count": 2,
            "lines": [
                {"line_x0": 50.0, "line_x1": 300.0, "line_y0": 100.0, "line_y1": 120.0, "text": "This is line one.", "bbox": [50.0, 100.0, 300.0, 120.0]},
                {"line_x0": 50.0, "line_x1": 300.0, "line_y0": 130.0, "line_y1": 150.0, "text": "This is line two.", "bbox": [50.0, 130.0, 300.0, 150.0]},
            ]
        }
        overflow_gap = {
            "paragraph_id": "p_0_1",
            "block_number": 1,
            "font_size": 10.0,
            "font_family": "TimesNewRoman",
            "bbox": [50.0, 152.0, 300.0, 190.0],
            "pdfX": 50.0,
            "pdfY_top": 152.0,
            "pdfW": 250.0,
            "pdfH": 38.0,
            "region_kind": "gap",
            "text": "This is line three.\nThis is the last line.",
            "line_count": 2,
            "lines": [
                {"line_x0": 50.0, "line_x1": 300.0, "line_y0": 152.0, "line_y1": 170.0, "text": "This is line three.", "bbox": [50.0, 152.0, 300.0, 170.0]},
                {"line_x0": 50.0, "line_x1": 200.0, "line_y0": 172.0, "line_y1": 190.0, "text": "This is the last line.", "bbox": [50.0, 172.0, 200.0, 190.0]},
            ]
        }

        self.assertTrue(_should_merge(parent_rect, overflow_gap))

        merged = _heal_rect_splits([parent_rect, overflow_gap], page_idx=0)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["paragraph_id"], "p_0_0")
        self.assertEqual(merged[0]["line_count"], 4)
        self.assertEqual(merged[0]["align"], "justify")
        self.assertEqual(merged[0]["bbox"], [50.0, 100.0, 300.0, 190.0])

    def test_should_not_merge_table_cells(self):
        cell_1 = {
            "region_kind": "rect",
            "font_size": 10.0,
            "font_family": "TimesNewRoman",
            "bbox": [50.0, 100.0, 150.0, 120.0],
            "pdfX": 50.0,
            "pdfW": 100.0,
            "lines": [],
        }
        cell_2 = {
            "region_kind": "gap",
            "font_size": 10.0,
            "font_family": "TimesNewRoman",
            "bbox": [200.0, 100.0, 300.0, 120.0], # Different left edge (200 vs 50)
            "pdfX": 200.0,
            "pdfW": 100.0,
            "lines": [],
        }
        self.assertFalse(_should_merge(cell_1, cell_2))

    def test_should_not_merge_different_fonts(self):
        rect = {
            "region_kind": "rect",
            "font_size": 12.0,
            "font_family": "Helvetica-Bold",
            "bbox": [50.0, 100.0, 300.0, 120.0],
            "pdfX": 50.0,
            "pdfW": 250.0,
            "lines": [],
        }
        gap = {
            "region_kind": "gap",
            "font_size": 9.0, # Different font size (9 vs 12)
            "font_family": "TimesNewRoman", # Different font family
            "bbox": [50.0, 122.0, 300.0, 140.0],
            "pdfX": 50.0,
            "pdfW": 250.0,
            "lines": [],
        }
        self.assertFalse(_should_merge(rect, gap))

    def test_collect_enclosing_rects_drops_nested_fill_only(self):
        """
        Two nested fill-only rects (accumulated bake fills) + one stroked rect.
        _collect_enclosing_rects must return only the OUTER fill + the stroked rect.
        The inner fill-only rect must be silently dropped.
        """
        outer_fill   = fitz.Rect(50, 100, 350, 300)   # fill-only, outer
        inner_fill   = fitz.Rect(60, 110, 340, 280)   # fill-only, nested inside outer
        stroked_cell = fitz.Rect(400, 100, 550, 200)  # stroked (table cell), NOT fill-only

        drawings = [
            # outer fill-only rect
            {"rect": outer_fill, "items": [("re", outer_fill)], "fill": (1, 1, 1), "color": None},
            # inner fill-only rect (nested inside outer — should be dropped)
            {"rect": inner_fill, "items": [("re", inner_fill)], "fill": (1, 1, 1), "color": None},
            # stroked rect — must always survive
            {"rect": stroked_cell, "items": [("re", stroked_cell)], "fill": None, "color": (0, 0, 0)},
        ]

        page = types.SimpleNamespace(
            rect=fitz.Rect(0, 0, 612, 792),
            get_drawings=lambda: drawings,
        )

        result = _collect_enclosing_rects(page)

        self.assertEqual(len(result), 2, f"Expected 2 rects (outer fill + stroked), got {len(result)}: {result}")
        areas = sorted(r.get_area() for r in result)
        expected_areas = sorted([outer_fill.get_area(), stroked_cell.get_area()])
        for got, exp in zip(areas, expected_areas):
            self.assertAlmostEqual(got, exp, places=0)
        inner_area = inner_fill.get_area()
        self.assertFalse(
            any(abs(r.get_area() - inner_area) < 1 for r in result),
            "Inner nested fill-only rect must be dropped"
        )

    def test_should_merge_rect_rect_nested_overflow(self):
        """rect+rect: b starts inside a's vertical extent (overflow assigned to outer fill on re-bake)."""
        inner_rect = {
            "paragraph_id": "p_3_3",
            "region_kind": "rect",
            "font_size": 10.0,
            "font_family": "NewBaskerville-Roman",
            "bbox": [50.0, 100.0, 300.0, 150.0],
            "pdfX": 50.0,
            "pdfW": 250.0,
            "lines": [
                {"line_x0": 50.0, "line_x1": 300.0, "line_y0": 100.0, "line_y1": 120.0, "bbox": [50.0, 100.0, 300.0, 120.0]},
                {"line_x0": 50.0, "line_x1": 300.0, "line_y0": 128.0, "line_y1": 148.0, "bbox": [50.0, 128.0, 300.0, 148.0]},
            ],
        }
        outer_rect = {
            "paragraph_id": "p_3_4",
            "region_kind": "rect",
            "font_size": 10.0,
            "font_family": "NewBaskerville-Roman",
            # b["bbox"][1] = 140 < a["bbox"][3] = 150  → nested overlap → should merge
            "bbox": [50.0, 140.0, 300.0, 200.0],
            "pdfX": 50.0,
            "pdfW": 250.0,
            "lines": [
                {"line_x0": 50.0, "line_x1": 300.0, "line_y0": 151.0, "line_y1": 171.0, "bbox": [50.0, 151.0, 300.0, 171.0]},
                {"line_x0": 50.0, "line_x1": 200.0, "line_y0": 179.0, "line_y1": 199.0, "bbox": [50.0, 179.0, 200.0, 199.0]},
            ],
        }
        self.assertTrue(_should_merge(inner_rect, outer_rect))

    def test_should_not_merge_rect_rect_disjoint_table_cells(self):
        """rect+rect: b starts BELOW a (disjoint table rows) → must reject."""
        cell_a = {
            "region_kind": "rect",
            "font_size": 10.0,
            "font_family": "Helvetica",
            "bbox": [50.0, 100.0, 300.0, 130.0],
            "pdfX": 50.0,
            "pdfW": 250.0,
            "lines": [],
        }
        cell_b = {
            "region_kind": "rect",
            "font_size": 10.0,
            "font_family": "Helvetica",
            # b["bbox"][1] = 131 >= a["bbox"][3] = 130 → disjoint → must NOT merge
            "bbox": [50.0, 131.0, 300.0, 160.0],
            "pdfX": 50.0,
            "pdfW": 250.0,
            "lines": [],
        }
        self.assertFalse(_should_merge(cell_a, cell_b))

if __name__ == "__main__":
    unittest.main()
