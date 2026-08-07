import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from converter.font_utils import root_family

def test_root_family_prefix_stripping():
    assert root_family("emb_OPYJSL+NewBaskervill-Roman") == "newbaskervill"
    assert root_family("F1_ABCDEF+HelveticaNeue-Bold") == "helveticaneue"
    assert root_family("g_d0_XYZWVT+TimesNewRoman-Italic") == "timesnewroman"
    assert root_family("font_OPYJSL+BookAntiqua") == "bookantiqua"
    assert root_family("OPYJSL+NewBaskerville-Regular") == "newbaskerville"
