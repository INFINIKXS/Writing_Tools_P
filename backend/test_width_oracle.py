import difflib
import unittest


def _build_oracle(raw_chars, paragraph_text, font_obj_stub, body=10.0, k_cal=1.0):
    try:
        _obs = {}
        for _i, _ch in enumerate(raw_chars):
            if _ch['size'] < 0.9 * body or _i + 1 >= len(raw_chars):
                continue
            _nx = raw_chars[_i + 1]
            if abs(_nx['oy'] - _ch['oy']) >= 1.0 or _nx['size'] < 0.9 * body:
                continue
            _adv_val = _nx['ox'] - _ch['ox']
            if 0.05 * _ch['size'] <= _adv_val <= 2.5 * _ch['size']:
                _obs.setdefault(_ch['c'], []).append(_adv_val)
        _adv = {_c: sorted(_v)[len(_v) // 2] for _c, _v in _obs.items() if _v}
        for _c in list(_adv):
            _nom = font_obj_stub.text_length(_c, fontsize=body)
            if _nom <= 0.05 or not (0.75 * _nom <= _adv[_c] <= 1.35 * _nom):
                del _adv[_c]
        _orig_str = ''.join(_ch['c'] for _ch in raw_chars)
        _segs = [
            (_m.a, _m.a + _m.size, _m.b, _m.b + _m.size)
            for _m in difflib.SequenceMatcher(None, _orig_str, paragraph_text, autojunk=False).get_matching_blocks()
            if _m.size
        ]
    except Exception:
        k_cal = 1.0
        _adv = {}
        _segs = []

    def _exact_width(text, j):
        if j is None or not raw_chars:
            return None
        for i1, i2, j1, j2 in _segs:
            if j1 <= j and j + len(text) <= j2:
                a = i1 + (j - j1)
                b = a + len(text)
                if b <= len(raw_chars) and abs(raw_chars[a]['oy'] - raw_chars[b - 1]['oy']) < 1.0:
                    return raw_chars[b - 1]['x1'] - raw_chars[a]['x0']
        return None

    def _tok_w(text, size, j=None):
        nom = font_obj_stub.text_length(text, fontsize=size) * k_cal
        if abs(size - body) < 0.5:
            try:
                ex = _exact_width(text, j)
                if ex is not None and 0.6 * nom <= ex <= 1.6 * nom:
                    return ex
                if all(_c in _adv for _c in text):
                    w = sum(_adv[_c] for _c in text)
                    if 0.6 * nom <= w <= 1.6 * nom:
                        return w
            except Exception:
                pass
        return nom

    return _adv, _segs, _exact_width, _tok_w


class MockFont:
    def text_length(self, text, fontsize=10.0):
        return len(text) * 0.6 * fontsize

BODY = 10.0
FONT = MockFont()

def _char(c, ox, oy, size=BODY, x0=None, x1=None):
    advance = 0.6 * size
    return {'c': c, 'ox': ox, 'oy': oy, 'size': size,
            'x0': ox if x0 is None else x0,
            'x1': (ox + advance) if x1 is None else x1}

class TestWidthOracle(unittest.TestCase):
    def test_cross_line_delta_rejected(self):
        raw = [
            _char('A', ox=50.0, oy=100.0),
            _char('B', ox=50.0, oy=112.0),  # oy differs by 12 -> cross-line
            _char('C', ox=56.0, oy=100.0),
        ]
        _adv, _segs, _exact, _tok_w = _build_oracle(raw, 'ABC', FONT, body=BODY)
        self.assertNotIn('A', _adv, 'Cross-line pair must be rejected from _adv')
        w = _tok_w('A', BODY, j=0)
        self.assertGreater(w, 0)

    def test_superscript_char_rejected(self):
        raw = [
            _char('x', ox=50.0, oy=100.0, size=BODY),
            _char('1', ox=56.0, oy=100.0, size=BODY * 0.65),  # superscript
            _char('y', ox=62.0, oy=100.0, size=BODY),
        ]
        _adv, _segs, _exact, _tok_w = _build_oracle(raw, 'x1y', FONT, body=BODY)
        self.assertNotIn('1', _adv, 'Superscript char must be excluded from _adv')
        w = _tok_w('1', BODY * 0.65, j=1)
        self.assertGreater(w, 0)

    def test_exact_segment_match(self):
        raw = [
            _char('H', ox=50.0, oy=100.0, x0=50.0, x1=56.0),
            _char('e', ox=56.0, oy=100.0, x0=56.0, x1=62.0),
            _char('l', ox=62.0, oy=100.0, x0=62.0, x1=67.0),
            _char('l', ox=67.0, oy=100.0, x0=67.0, x1=72.0),
            _char('o', ox=72.0, oy=100.0, x0=72.0, x1=79.0),
        ]
        _adv, _segs, _exact, _tok_w = _build_oracle(raw, 'Hello', FONT, body=BODY)
        w = _tok_w('Hello', BODY, j=0)
        self.assertAlmostEqual(w, 29.0, places=1, msg='Exact segment match must return raw_chars pixel width')

    def test_kill_switch_empty_raw_chars(self):
        raw = []
        _adv, _segs, _exact, _tok_w = _build_oracle(raw, 'Hello world', FONT, body=BODY, k_cal=1.0)
        for word in ['Hello', 'world']:
            nom = FONT.text_length(word, fontsize=BODY) * 1.0
            w = _tok_w(word, BODY, j=0)
            self.assertAlmostEqual(w, nom, places=6, msg='Kill-switch: empty raw_chars must yield nominal*k')

    def test_result_never_nonpositive(self):
        raw = []
        _adv, _segs, _exact, _tok_w = _build_oracle(raw, 'abc', FONT, body=BODY)
        for text in ['a', 'ab', 'abc', ' ']:
            w = _tok_w(text, BODY, j=0)
            self.assertGreater(w, 0, f'Width must be positive for {text!r}, got {w}')

if __name__ == '__main__':
    unittest.main()
