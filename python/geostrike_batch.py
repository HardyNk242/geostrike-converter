#!/usr/bin/env python3
"""
GeoStrike Batch — conversion en lot de mesures structurales planaires.

Port Python fidèle des formules du site GeoStrike Converter (utils/geoMath.ts)
+ angles Adobe Illustrator (0° = Est, sens antihoraire).

Notations gérées
----------------
  Quadrant   : N45E/30SE      (strike quadrant / dip + quadrant de pendage)
  Azimuth    : 045/30SE       (strike azimut / dip + quadrant de pendage)
  RHR        : 045/30         (strike règle de la main droite / dip)
  DipDipDir  : 30/135         (dip / direction de pendage azimutale)

Formules internes (plan normalisé en RHR strike / dip / dipDir)
---------------------------------------------------------------
  Quadrant -> azimut : NθE=θ, SθE=180-θ, SθW=180+θ, NθW=360-θ
  RHR                : dipDir = (strike + 90) mod 360
  Dip/DipDir         : strike = (dipDir - 90) mod 360
  Azimut / Quadrant  : le dipDir est le candidat (strike ± 90) qui tombe
                       dans le quadrant de pendage donné ; si c'est strike-90
                       on retourne le strike de 180° pour rester en RHR.
  Illustrator        : θ_ill = (90 - Az) mod 360
                       ligne de strike  = (90 - strike_RHR) mod 360
                       tick de pendage  = (90 - dipDir) mod 360

Utilisation en ligne de commande
--------------------------------
  python geostrike_batch.py mesures.xlsx                  -> mesures_converted.xlsx
  python geostrike_batch.py mesures.csv -o resultat.csv
  python geostrike_batch.py mesures.xlsx --format strike_sense
  python geostrike_batch.py mesures.xlsx --outputs quadrant,rhr,illustrator

Types de données de départ (--format) — mêmes modèles que le site :
  strike_sense : Strike 0-360 + Dip + Sens_pendage (N,S,E,W,NE...)  -> azimut sans RHR
  rhr          : Strike_RHR + Dip                                    -> règle de la main droite
  dipdir       : Dip + DipDir                                        -> dip / direction de pendage
  quadrant     : Strike "N45E" + Dip + Sens_pendage                  -> quadrant
  strike180    : Strike 0-180 + Dip + Sens_pendage facultatif        -> azimut si sens, sinon RHR
  auto (défaut): colonne "Mesure" en texte libre ou colonnes mixtes, détection par ligne

Colonnes acceptées dans le fichier d'entrée (insensible à la casse) :
  * une colonne texte "notation" / "mesure" / "measurement" / "value"
    contenant la mesure complète (ex. "N45E/30SE") ; ou
  * des colonnes numériques : strike, dip, dipdir (ou dip_dir / dip_direction),
    quad (quadrant de pendage NE/SE/SW/NW) ;
  * facultatif : "mode" / "format" par ligne (Quadrant, Azimuth, RHR, DipDipDir).
  Toute autre colonne (ID, station, lithologie, X, Y...) est recopiée telle quelle.

Dépendances : pandas, openpyxl (pip install pandas openpyxl)
"""

from __future__ import annotations

import argparse
import math
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

MODES = ("Quadrant", "Azimuth", "RHR", "DipDipDir")
QUADRANTS = ("NE", "SE", "SW", "NW")


# ---------------------------------------------------------------------------
# Helpers (port de geoMath.ts)
# ---------------------------------------------------------------------------

def format3(val: float) -> str:
    return f"{int(round(val)):03d}"


def format2(val: float) -> str:
    return f"{int(round(val)):02d}"


def normalize(angle: float) -> float:
    res = math.fmod(angle, 360.0)
    if res < 0:
        res += 360.0
    if res == 360.0 or abs(res) < 1e-4:
        res = 0.0
    return res


def is_angle_in_quad(angle: float, q: str) -> bool:
    n = normalize(angle)
    if q == "NE":
        return 0 <= n <= 90
    if q == "SE":
        return 90 <= n <= 180
    if q == "SW":
        return 180 <= n <= 270
    if q == "NW":
        return n >= 270 or n == 0
    return False


def quad_from_azimuth(angle: float) -> str:
    n = normalize(angle)
    if 0 < n <= 90:
        return "NE"
    if 90 < n <= 180:
        return "SE"
    if 180 < n <= 270:
        return "SW"
    return "NW"


def illustrator_angle(azimuth: float) -> float:
    """Azimut géologique (0=N, horaire) -> angle Illustrator (0=E, antihoraire)."""
    return normalize(90 - azimuth)


# ---------------------------------------------------------------------------
# Modèle d'entrée / de sortie
# ---------------------------------------------------------------------------

@dataclass
class PlaneInput:
    mode: str
    dip: float = 0.0
    # Quadrant
    quad_start: str = "N"
    quad_angle: float = 0.0
    quad_end: str = "E"
    quad_dip_quad: str = "SE"
    # Azimuth
    az_strike: float = 0.0
    az_dip_quad: str = "SE"
    # RHR
    rhr_strike: float = 0.0
    # DipDipDir
    dd_dip_dir: float = 0.0


@dataclass
class ConversionResult:
    is_valid: bool
    error: Optional[str] = None
    rhr_strike: float = 0.0
    dip_direction: float = 0.0
    dip: float = 0.0
    quadrant_notation: str = "---"
    azimuth_notation: str = "---"
    rhr_notation: str = "---"
    dip_dipdir_notation: str = "---"
    illustrator_strike: Optional[float] = None
    illustrator_dip_tick: Optional[float] = None

    def as_row(self) -> dict:
        ok = self.is_valid
        return {
            "Valid": "OK" if ok else "ERROR",
            "Error": self.error or "",
            "Quadrant": self.quadrant_notation,
            "Azimuth": self.azimuth_notation,
            "RHR": self.rhr_notation,
            "DipDipDir": self.dip_dipdir_notation,
            "Strike_RHR": round(self.rhr_strike, 2) if ok else None,
            "Dip": round(self.dip, 2) if ok else None,
            "DipDir": round(self.dip_direction, 2) if ok else None,
            "Illustrator_Strike": round(self.illustrator_strike, 2) if ok else None,
            "Illustrator_DipTick": round(self.illustrator_dip_tick, 2) if ok else None,
        }


# ---------------------------------------------------------------------------
# Cœur de conversion (port de getPlaneFromInput + calculateConversion)
# ---------------------------------------------------------------------------

def _plane_from_input(inp: PlaneInput):
    dip = inp.dip or 0.0
    if dip < 0 or dip > 90:
        return None, "Dip angle must be between 0 and 90 degrees."

    if inp.mode == "DipDipDir":
        dd = inp.dd_dip_dir or 0.0
        if dd < 0 or dd > 360:
            return None, "Dip direction must be between 0 and 360 degrees."
        return (normalize(dd - 90), dip, normalize(dd)), None

    if inp.mode == "RHR":
        s = inp.rhr_strike or 0.0
        if s < 0 or s > 360:
            return None, "RHR strike must be between 0 and 360 degrees."
        return (normalize(s), dip, normalize(s + 90)), None

    if inp.mode in ("Azimuth", "Quadrant"):
        if inp.mode == "Azimuth":
            az = inp.az_strike or 0.0
            if az < 0 or az > 360:
                return None, "Strike azimuth must be between 0 and 360 degrees."
            q = inp.az_dip_quad or "SE"
            label = format3(az)
        else:
            ang = inp.quad_angle or 0.0
            if ang < 0 or ang > 90:
                return None, "Quadrant angle must be between 0 and 90 degrees."
            start, end = inp.quad_start or "N", inp.quad_end or "E"
            if start == "N" and end == "E":
                az = ang
            elif start == "S" and end == "E":
                az = 180 - ang
            elif start == "S" and end == "W":
                az = 180 + ang
            elif start == "N" and end == "W":
                az = 360 - ang
            else:
                az = 0.0
            q = inp.quad_dip_quad or "SE"
            label = f"{start}{format2(ang)}{end} (Az: {format3(normalize(az))})"

        az = normalize(az)
        cand1 = normalize(az + 90)   # à droite
        cand2 = normalize(az - 90)   # à gauche
        if is_angle_in_quad(cand1, q):
            return (az, dip, cand1), None
        if is_angle_in_quad(cand2, q):
            return (normalize(az + 180), dip, cand2), None
        return None, f"Dip quadrant {q} is not perpendicular to strike {label}."

    return None, "Unknown mode"


def calculate_conversion(inp: PlaneInput) -> ConversionResult:
    plane, error = _plane_from_input(inp)
    if error or plane is None:
        return ConversionResult(is_valid=False, error=error)

    strike, dip, dip_dir = plane
    dip_quad = quad_from_azimuth(dip_dir)

    if 0 <= strike <= 90:
        quad_str = f"N{format2(strike)}E"
    elif 90 < strike <= 180:
        quad_str = f"S{format2(180 - strike)}E"
    elif 180 < strike <= 270:
        quad_str = f"S{format2(strike - 180)}W"
    else:
        quad_str = f"N{format2(360 - strike)}W"

    return ConversionResult(
        is_valid=True,
        rhr_strike=strike,
        dip_direction=dip_dir,
        dip=dip,
        quadrant_notation=f"{quad_str}/{format2(dip)}{dip_quad}",
        azimuth_notation=f"{format3(strike)}/{format2(dip)}{dip_quad}",
        rhr_notation=f"{format3(strike)}/{format2(dip)}",
        dip_dipdir_notation=f"{format2(dip)}/{format3(dip_dir)}",
        illustrator_strike=illustrator_angle(strike),
        illustrator_dip_tick=illustrator_angle(dip_dir),
    )


# ---------------------------------------------------------------------------
# Parsing d'une mesure texte  ("N45E/30SE", "045/30SE", "045/30", "30/135")
# ---------------------------------------------------------------------------

_SEP = r"[\s/,;|\-]+"
_RE_QUAD = re.compile(
    r"^\s*([NS])\s*(\d+(?:\.\d+)?)\s*([EW])\s*" + _SEP +
    r"\s*(\d+(?:\.\d+)?)\s*°?\s*([NS][EW]|[NSEW])?\s*$",
    re.I,
)
_RE_TWO = re.compile(
    r"^\s*(\d+(?:\.\d+)?)\s*°?\s*" + _SEP +
    r"\s*(\d+(?:\.\d+)?)\s*°?\s*([NS][EW]|[NSEW])?\s*$",
    re.I,
)


def _clean_quad(q: Optional[str]) -> Optional[str]:
    """Retourne NE/SE/SW/NW, ou une lettre seule N/S/E/W (résolue plus tard)."""
    if not q:
        return None
    q = re.sub(r"[^NSEW]", "", str(q).upper().replace("O", "W"))
    return q if q in QUADRANTS or q in ("N", "S", "E", "W") else None


def _resolve_single_letter(letter: str, strike_az: float) -> str:
    """Résout un quadrant à une lettre (E, W, N, S) en NE/SE/SW/NW en
    choisissant le candidat perpendiculaire (strike ± 90) qui pointe vers
    cette lettre."""
    for cand in (normalize(strike_az + 90), normalize(strike_az - 90)):
        q = quad_from_azimuth(cand)
        if letter in q:
            return q
    return {"E": "SE", "W": "NW", "N": "NE", "S": "SW"}[letter]


def parse_notation(text: str, default_mode: str = "auto") -> PlaneInput:
    """Transforme une chaîne en PlaneInput. Lève ValueError si illisible.

    default_mode : mode utilisé quand la chaîne "a/b" est ambiguë
    ("auto" -> DipDipDir si b > 90, sinon RHR).
    """
    s = str(text).strip()
    if not s:
        raise ValueError("Empty measurement")

    m = _RE_QUAD.match(s)
    if m:
        start, ang, end, dip, q = m.groups()
        start, end = start.upper(), end.upper()
        az = {("N", "E"): float(ang), ("S", "E"): 180 - float(ang),
              ("S", "W"): 180 + float(ang), ("N", "W"): 360 - float(ang)}[(start, end)]
        q = _clean_quad(q)
        if q is None:
            raise ValueError(f"Missing dip quadrant in '{s}'")
        if len(q) == 1:
            q = _resolve_single_letter(q, az)
        return PlaneInput(mode="Quadrant", dip=float(dip), quad_start=start,
                          quad_angle=float(ang), quad_end=end, quad_dip_quad=q)

    m = _RE_TWO.match(s)
    if not m:
        raise ValueError(f"Unrecognised measurement '{s}'")
    a, b, q = float(m.group(1)), float(m.group(2)), _clean_quad(m.group(3))

    if q:                                   # 045/30SE -> Azimuth
        if len(q) == 1:
            q = _resolve_single_letter(q, a)
        return PlaneInput(mode="Azimuth", dip=b, az_strike=a, az_dip_quad=q)

    mode = default_mode
    if mode in ("auto", "", None):
        if b > 90:
            mode = "DipDipDir"              # 30/135
        else:
            mode = "RHR"                    # 120/30 ou ambigu -> strike/dip
    if mode == "DipDipDir":
        return PlaneInput(mode="DipDipDir", dip=a, dd_dip_dir=b)
    if mode == "RHR":
        return PlaneInput(mode="RHR", dip=b, rhr_strike=a)
    if mode == "Azimuth":
        raise ValueError(f"Azimuth notation needs a dip quadrant (e.g. 045/30SE): '{s}'")
    if mode == "Quadrant":
        raise ValueError(f"Quadrant notation needs N/S and E/W letters (e.g. N45E/30SE): '{s}'")
    raise ValueError(f"Unknown mode '{mode}'")


# ---------------------------------------------------------------------------
# Traitement d'un tableau (pandas)
# ---------------------------------------------------------------------------

_NOTATION_COLS = ("notation", "mesure", "mesures", "measurement", "measure",
                  "value", "valeur", "plan", "plane", "orientation")
_STRIKE_COLS = ("strike", "direction", "azimut", "azimuth", "az", "quad_angle", "angle")
_DIP_COLS = ("dip", "pendage", "plunge")
_DIPDIR_COLS = ("dipdir", "dip_dir", "dip_direction", "dipdirection",
                "direction_pendage", "dir_pendage", "dd")
_QUAD_COLS = ("sens_pendage", "sens_du_pendage", "sens", "sense", "dip_sense",
              "quad", "quadrant", "dip_quad", "dipquad", "dip_quadrant")
_STRIKE_COLS = _STRIKE_COLS + ("strike_rhr",)
FORMATS = ("auto", "strike_sense", "rhr", "dipdir", "quadrant", "strike180")
OUTPUT_GROUPS = {
    "quadrant": ["Quadrant"], "azimuth": ["Azimuth"], "rhr": ["RHR"], "dipdir": ["DipDipDir"],
    "numeric": ["Strike_RHR", "Dip", "DipDir"], "illustrator": ["Illustrator_Strike", "Illustrator_DipTick"],
}
_MODE_COLS = ("mode", "format", "notation_type", "type")


def _find_col(columns, candidates) -> Optional[str]:
    lower = {str(c).strip().lower().replace(" ", "_"): c for c in columns}
    for cand in candidates:
        if cand in lower:
            return lower[cand]
    return None


def _norm_mode(v) -> Optional[str]:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    t = str(v).strip().lower().replace(" ", "").replace("/", "").replace("_", "")
    table = {
        "quadrant": "Quadrant", "quad": "Quadrant",
        "azimuth": "Azimuth", "azimut": "Azimuth", "az": "Azimuth",
        "rhr": "RHR", "strikedip": "RHR", "righthandrule": "RHR",
        "dipdipdir": "DipDipDir", "dipdir": "DipDipDir", "dipdirection": "DipDipDir",
        "dd": "DipDipDir",
    }
    return table.get(t)


def _is_blank(v) -> bool:
    return v is None or (isinstance(v, float) and math.isnan(v)) or str(v).strip() in ("", "nan", "None")


def _quadrant_from_raw(raw: str, dip: float, sense: Optional[str]) -> PlaneInput:
    m = re.match(r"^\s*([NS])\s*(\d+(?:\.\d+)?)\s*([EW])\s*$", str(raw), re.I)
    if not m:
        raise ValueError(f"Unrecognised quadrant strike '{raw}' (expected e.g. N45E)")
    if not sense:
        raise ValueError("Missing dip sense (Sens_pendage column) for quadrant format")
    start, ang, end = m.group(1).upper(), float(m.group(2)), m.group(3).upper()
    az = {("N", "E"): ang, ("S", "E"): 180 - ang, ("S", "W"): 180 + ang, ("N", "W"): 360 - ang}[(start, end)]
    q = _resolve_single_letter(sense, az) if len(sense) == 1 else sense
    return PlaneInput(mode="Quadrant", dip=dip, quad_start=start, quad_angle=ang, quad_end=end, quad_dip_quad=q)


def _azimuth_with_sense(strike: float, dip: float, sense: str) -> PlaneInput:
    q = _resolve_single_letter(sense, strike) if len(sense) == 1 else sense
    return PlaneInput(mode="Azimuth", dip=dip, az_strike=strike, az_dip_quad=q)


def row_to_input(row: dict, columns, default_mode: str = "auto", fmt: str = "auto") -> PlaneInput:
    """Construit un PlaneInput depuis une ligne (dict colonne -> valeur).

    fmt : type de données de départ (voir FORMATS). "auto" = détection par ligne.
    """
    if fmt != "auto":
        strike_col = _find_col(columns, _STRIKE_COLS)
        dip_col = _find_col(columns, _DIP_COLS)
        dipdir_col = _find_col(columns, _DIPDIR_COLS)
        sense_col = _find_col(columns, _QUAD_COLS)

        def num(col):
            if col is None or _is_blank(row.get(col)):
                return None
            return float(str(row[col]).replace(",", ".").replace("°", "").strip())

        dip = num(dip_col)
        if dip is None:
            raise ValueError("Missing dip value")
        sense_raw = None if sense_col is None or _is_blank(row.get(sense_col)) else str(row[sense_col])
        sense = _clean_quad(sense_raw) if sense_raw else None
        if sense_raw and not sense:
            raise ValueError(f"Unrecognised dip sense '{sense_raw}' (use N, S, E, W, NE, SE, SW, NW)")
        strike_raw = row.get(strike_col) if strike_col else None

        if fmt == "dipdir":
            dd = num(dipdir_col)
            if dd is None:
                raise ValueError("Missing dip direction (DipDir column)")
            return PlaneInput(mode="DipDipDir", dip=dip, dd_dip_dir=dd)
        if fmt == "quadrant":
            if not isinstance(strike_raw, str) or not re.match(r"^\s*[NS]\s*\d", strike_raw, re.I):
                raise ValueError(f"Strike must be a quadrant bearing like N45E (got '{strike_raw}')")
            return _quadrant_from_raw(strike_raw, dip, sense)
        strike = num(strike_col)
        if strike is None:
            raise ValueError("Missing strike value")
        if fmt == "rhr":
            return PlaneInput(mode="RHR", dip=dip, rhr_strike=strike)
        if fmt == "strike_sense":
            if not sense:
                raise ValueError("Missing dip sense (Sens_pendage column): required for non-RHR strike")
            return _azimuth_with_sense(strike, dip, sense)
        if fmt == "strike180":
            if strike > 180:
                raise ValueError(f"Strike {strike} is outside 0-180 (use the 0-360 + dip sense format)")
            return _azimuth_with_sense(strike, dip, sense) if sense else PlaneInput(mode="RHR", dip=dip, rhr_strike=strike)
        raise ValueError(f"Unknown format '{fmt}'")

    mode_col = _find_col(columns, _MODE_COLS)
    mode = _norm_mode(row.get(mode_col)) if mode_col else None
    mode = mode or default_mode

    notation_col = _find_col(columns, _NOTATION_COLS)
    if notation_col and not _is_blank(row.get(notation_col)):
        return parse_notation(row[notation_col], mode)

    strike_col = _find_col(columns, _STRIKE_COLS)
    dip_col = _find_col(columns, _DIP_COLS)
    dipdir_col = _find_col(columns, _DIPDIR_COLS)
    quad_col = _find_col(columns, _QUAD_COLS)

    def num(col):
        if col is None or _is_blank(row.get(col)):
            return None
        return float(str(row[col]).replace(",", ".").replace("°", "").strip())

    dip = num(dip_col)
    if dip is None:
        raise ValueError("Missing dip value")

    quad = "" if quad_col is None or _is_blank(row.get(quad_col)) else str(row[quad_col]).strip().upper()
    quad = quad if (quad in QUADRANTS or quad in ("N", "S", "E", "W")) else ""

    # Le strike peut lui-même être en quadrant ("N45E") -> on le parse.
    strike_raw = row.get(strike_col) if strike_col else None
    if isinstance(strike_raw, str) and re.match(r"^\s*[NS]\s*\d", strike_raw, re.I):
        return parse_notation(f"{strike_raw}/{dip}{quad}", "Quadrant")

    strike = num(strike_col)
    dipdir = num(dipdir_col)

    if mode in ("auto", "", None):
        if dipdir is not None and strike is None:
            mode = "DipDipDir"
        elif quad:
            mode = "Azimuth"
        else:
            mode = "RHR"

    if mode == "DipDipDir":
        if dipdir is None:
            raise ValueError("Missing dip direction (dipdir column)")
        return PlaneInput(mode="DipDipDir", dip=dip, dd_dip_dir=dipdir)
    if strike is None:
        raise ValueError("Missing strike value")
    if mode == "RHR":
        return PlaneInput(mode="RHR", dip=dip, rhr_strike=strike)
    if mode == "Azimuth":
        if not quad:
            raise ValueError("Missing dip quadrant (quad column) for Azimuth mode")
        if len(quad) == 1:
            quad = _resolve_single_letter(quad, strike)
        return PlaneInput(mode="Azimuth", dip=dip, az_strike=strike, az_dip_quad=quad)
    if mode == "Quadrant":
        raise ValueError("Quadrant mode needs a strike like 'N45E' (or a notation column)")
    raise ValueError(f"Unknown mode '{mode}'")


def process_dataframe(df, default_mode: str = "auto", fmt: str = "auto", outputs=None):
    """Ajoute les colonnes de conversion à un DataFrame et le retourne.

    outputs : liste de groupes de sortie (clés de OUTPUT_GROUPS) ; None = tous.
    Une colonne calculée homonyme d'une colonne source est suffixée "_conv".
    """
    import pandas as pd

    results = []
    for _, r in df.iterrows():
        row = r.to_dict()
        try:
            inp = row_to_input(row, df.columns, default_mode, fmt)
            res = calculate_conversion(inp)
            out = res.as_row()
            out["Input_Mode"] = inp.mode
        except Exception as exc:  # noqa: BLE001
            out = ConversionResult(is_valid=False, error=str(exc)).as_row()
            out["Input_Mode"] = ""
        results.append(out)

    res_df = pd.DataFrame(results)
    groups = list(OUTPUT_GROUPS) if outputs is None else [g for g in OUTPUT_GROUPS if g in outputs]
    cols = ["Input_Mode", "Valid", "Error"] + [c for g in groups for c in OUTPUT_GROUPS[g]]
    res_df = res_df[cols]
    src_cols = {str(c) for c in df.columns}
    res_df = res_df.rename(columns={c: f"{c}_conv" for c in cols if c in src_cols})
    return pd.concat([df.reset_index(drop=True), res_df], axis=1)


def process_file(path, output=None, default_mode: str = "auto", sheet=0,
                 fmt: str = "auto", outputs=None) -> Path:
    import pandas as pd

    path = Path(path)
    if path.suffix.lower() in (".xlsx", ".xlsm", ".xls"):
        df = pd.read_excel(path, sheet_name=sheet)
    else:
        df = pd.read_csv(path, sep=None, engine="python")

    out_df = process_dataframe(df, default_mode, fmt, outputs)

    if output is None:
        ext = ".xlsx" if path.suffix.lower() in (".xlsx", ".xlsm", ".xls") else ".csv"
        output = path.with_name(f"{path.stem}_converted{ext}")
    output = Path(output)
    if output.suffix.lower() in (".xlsx", ".xlsm"):
        with pd.ExcelWriter(output, engine="openpyxl") as xw:
            out_df.to_excel(xw, index=False, sheet_name="Conversions")
            ws = xw.sheets["Conversions"]
            for col_cells in ws.columns:
                width = max(len(str(c.value)) if c.value is not None else 0 for c in col_cells)
                ws.column_dimensions[col_cells[0].column_letter].width = min(max(10, width + 2), 45)
    else:
        out_df.to_csv(output, index=False)

    n_ok = int((out_df["Valid"] == "OK").sum())
    print(f"{len(out_df)} lignes traitées, {n_ok} OK, {len(out_df) - n_ok} en erreur -> {output}")
    return output


def main(argv=None):
    p = argparse.ArgumentParser(description="Conversion en lot de mesures structurales (GeoStrike).")
    p.add_argument("input", help="Fichier .xlsx / .xls / .csv")
    p.add_argument("-o", "--output", help="Fichier de sortie (.xlsx ou .csv). Défaut: <input>_converted.<ext>")
    p.add_argument("--mode", default="auto", choices=("auto",) + MODES,
                   help="Format d'entrée par défaut pour les lignes ambiguës (défaut: auto)")
    p.add_argument("--format", default="auto", choices=FORMATS, dest="fmt",
                   help="Type de données de départ (modèle utilisé). Défaut: auto")
    p.add_argument("--outputs", default=None,
                   help="Groupes de sortie séparés par des virgules: " + ",".join(OUTPUT_GROUPS) + " (défaut: tous)")
    p.add_argument("--sheet", default="0", help="Nom ou index de la feuille Excel (défaut: 0)")
    args = p.parse_args(argv)
    sheet = int(args.sheet) if str(args.sheet).isdigit() else args.sheet
    outputs = [o.strip() for o in args.outputs.split(",")] if args.outputs else None
    process_file(args.input, args.output, args.mode, sheet, args.fmt, outputs)


if __name__ == "__main__":
    sys.exit(main())
