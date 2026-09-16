"""Tests rapides : python -m pytest python/  (ou python python/test_geostrike_batch.py)"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from geostrike_batch import PlaneInput, calculate_conversion, parse_notation, process_dataframe  # noqa: E402


def conv(text, mode="auto"):
    return calculate_conversion(parse_notation(text, mode))


def test_site_default_example():
    r = conv("N45E/45SE")
    assert r.quadrant_notation == "N45E/45SE"
    assert r.azimuth_notation == "045/45SE"
    assert r.rhr_notation == "045/45"
    assert r.dip_dipdir_notation == "45/135"
    assert r.illustrator_strike == 45          # (90-45)
    assert r.illustrator_dip_tick == 315       # (90-135) mod 360


def test_quadrant_left_dip_flips_strike():
    # N45E dipping NW -> RHR strike must be 225
    r = conv("N45E/30NW")
    assert r.rhr_notation == "225/30"
    assert r.dip_dipdir_notation == "30/315"
    assert r.quadrant_notation == "S45W/30NW"


def test_quadrant_all_four():
    assert conv("S30E/20SW").rhr_notation == "150/20"
    assert conv("S30W/20NW").rhr_notation == "210/20"
    assert conv("N30W/20NE").rhr_notation == "330/20"
    assert conv("N30W/20SW").rhr_notation == "150/20"


def test_azimuth_notation():
    # 300+90 = 030 (NE) n'est pas SW ; 300-90 = 210 (SW) -> strike RHR bascule à 120
    r = conv("300/45SW")
    assert r.dip_dipdir_notation == "45/210"
    assert r.rhr_notation == "120/45"
    assert conv("300/45NE").rhr_notation == "300/45"


def test_dip_dipdir_auto():
    r = conv("30/135")
    assert r.rhr_notation == "045/30"
    assert r.quadrant_notation == "N45E/30SE"


def test_rhr_auto_and_ambiguous():
    assert conv("120/30").dip_dipdir_notation == "30/210"     # b<=90 -> RHR
    assert conv("045/30").rhr_notation == "045/30"            # ambigu -> RHR
    assert conv("045/30", "DipDipDir").rhr_notation == "300/45"


def test_single_letter_quadrant():
    # N45E dipping "E" -> SE ; dipping "W" -> NW
    assert conv("N45E/30E").dip_dipdir_notation == "30/135"
    assert conv("N45E/30W").dip_dipdir_notation == "30/315"


def test_illustrator_anchors():
    for az, ill in ((0, 90), (90, 0), (180, 270), (270, 180)):
        r = calculate_conversion(PlaneInput(mode="DipDipDir", dip=10, dd_dip_dir=az))
        assert r.illustrator_dip_tick == ill


def test_errors():
    assert not calculate_conversion(PlaneInput(mode="RHR", dip=95, rhr_strike=10)).is_valid
    r = calculate_conversion(PlaneInput(mode="Azimuth", dip=10, az_strike=45, az_dip_quad="SW"))
    assert not r.is_valid and "not perpendicular" in r.error


def test_dataframe_columns():
    import pandas as pd
    df = pd.DataFrame({
        "ID": ["A", "B", "C", "D", "E"],
        "notation": ["N45E/45SE", "30/135", "", None, "garbage"],
        "strike": [None, None, 120, "N10W", None],
        "dip": [None, None, 30, 20, None],
        "quad": [None, None, None, "NE", None],
    })
    out = process_dataframe(df)
    assert list(out["Valid"]) == ["OK", "OK", "OK", "OK", "ERROR"]
    assert list(out["RHR"])[:4] == ["045/45", "045/30", "120/30", "350/20"]
    assert out["Input_Mode"].tolist()[:4] == ["Quadrant", "DipDipDir", "RHR", "Quadrant"]


if __name__ == "__main__":
    import pytest
    sys.exit(pytest.main([__file__, "-q"]))
