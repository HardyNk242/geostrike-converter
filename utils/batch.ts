import { CompassDir, Quadrant, InputMode, PlaneInput, ConversionResult } from '../types';
import { calculateConversion, normalize } from './geoMath';

// Batch parsing / conversion of tabular measurements.
// Mirrors python/geostrike_batch.py — keep both in sync.

export type DefaultMode = 'auto' | InputMode;

export interface BatchRow {
  index: number;
  source: Record<string, unknown>;
  inputMode: string;
  result: ConversionResult;
  illustratorStrike?: number;
  illustratorDipTick?: number;
}

// Geological azimuth (0=N, clockwise) -> Illustrator angle (0=E, counterclockwise)
export const illustratorAngle = (azimuth: number): number => normalize(90 - azimuth);

// --- Column detection --------------------------------------------------------

const NOTATION_COLS = ['notation', 'mesure', 'mesures', 'measurement', 'measure', 'value', 'valeur', 'plan', 'plane', 'orientation'];
const STRIKE_COLS = ['strike', 'direction', 'azimut', 'azimuth', 'az', 'quad_angle', 'angle'];
const DIP_COLS = ['dip', 'pendage', 'plunge'];
const DIPDIR_COLS = ['dipdir', 'dip_dir', 'dip_direction', 'dipdirection', 'direction_pendage', 'dir_pendage', 'dd'];
const QUAD_COLS = ['quad', 'quadrant', 'dip_quad', 'dipquad', 'dip_quadrant'];
const MODE_COLS = ['mode', 'format', 'notation_type', 'type'];

const findCol = (columns: string[], candidates: string[]): string | undefined => {
  const lower = new Map(columns.map(c => [String(c).trim().toLowerCase().replace(/\s+/g, '_'), c]));
  for (const cand of candidates) {
    const hit = lower.get(cand);
    if (hit !== undefined) return hit;
  }
  return undefined;
};

const isBlank = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'number' && isNaN(v)) || String(v).trim() === '';

const toNum = (v: unknown): number | undefined => {
  if (isBlank(v)) return undefined;
  const n = parseFloat(String(v).replace(',', '.').replace('°', '').trim());
  return isNaN(n) ? undefined : n;
};

const normMode = (v: unknown): InputMode | undefined => {
  if (isBlank(v)) return undefined;
  const t = String(v).trim().toLowerCase().replace(/[\s/_]/g, '');
  const table: Record<string, InputMode> = {
    quadrant: InputMode.Quadrant, quad: InputMode.Quadrant,
    azimuth: InputMode.Azimuth, azimut: InputMode.Azimuth, az: InputMode.Azimuth,
    rhr: InputMode.RHR, strikedip: InputMode.RHR, righthandrule: InputMode.RHR,
    dipdipdir: InputMode.DipDipDir, dipdir: InputMode.DipDipDir, dipdirection: InputMode.DipDipDir, dd: InputMode.DipDipDir,
  };
  return table[t];
};

// --- Notation string parsing -------------------------------------------------

const SEP = '[\\s/,;|\\-]+';
const RE_QUAD = new RegExp(`^\\s*([NS])\\s*(\\d+(?:\\.\\d+)?)\\s*([EW])\\s*${SEP}\\s*(\\d+(?:\\.\\d+)?)\\s*°?\\s*([NS][EW]|[NSEW])?\\s*$`, 'i');
const RE_TWO = new RegExp(`^\\s*(\\d+(?:\\.\\d+)?)\\s*°?\\s*${SEP}\\s*(\\d+(?:\\.\\d+)?)\\s*°?\\s*([NS][EW]|[NSEW])?\\s*$`, 'i');

const quadFromAzimuth = (angle: number): Quadrant => {
  const n = normalize(angle);
  if (n > 0 && n <= 90) return Quadrant.NE;
  if (n > 90 && n <= 180) return Quadrant.SE;
  if (n > 180 && n <= 270) return Quadrant.SW;
  return Quadrant.NW;
};

const cleanQuad = (q?: string): string | undefined => {
  if (!q) return undefined;
  const u = q.toUpperCase();
  return (Object.values(Quadrant) as string[]).includes(u) || ['N', 'S', 'E', 'W'].includes(u) ? u : undefined;
};

// Single letter (E, W, N, S) -> full quadrant, picking the perpendicular candidate that points that way.
const resolveSingleLetter = (letter: string, strikeAz: number): Quadrant => {
  for (const cand of [normalize(strikeAz + 90), normalize(strikeAz - 90)]) {
    const q = quadFromAzimuth(cand);
    if (q.includes(letter)) return q;
  }
  return ({ E: Quadrant.SE, W: Quadrant.NW, N: Quadrant.NE, S: Quadrant.SW } as Record<string, Quadrant>)[letter];
};

export const parseNotation = (text: string, defaultMode: DefaultMode = 'auto'): PlaneInput => {
  const s = String(text).trim();
  if (!s) throw new Error('Empty measurement');

  let m = s.match(RE_QUAD);
  if (m) {
    const start = m[1].toUpperCase() as CompassDir.N | CompassDir.S;
    const ang = parseFloat(m[2]);
    const end = m[3].toUpperCase() as CompassDir.E | CompassDir.W;
    const dip = parseFloat(m[4]);
    const az = start === 'N' && end === 'E' ? ang : start === 'S' && end === 'E' ? 180 - ang : start === 'S' && end === 'W' ? 180 + ang : 360 - ang;
    let q = cleanQuad(m[5]);
    if (!q) throw new Error(`Missing dip quadrant in '${s}'`);
    if (q.length === 1) q = resolveSingleLetter(q, az);
    return { mode: InputMode.Quadrant, dip, quadStart: start, quadAngle: ang, quadEnd: end, quadDipQuad: q as Quadrant };
  }

  m = s.match(RE_TWO);
  if (!m) throw new Error(`Unrecognised measurement '${s}'`);
  const a = parseFloat(m[1]);
  const b = parseFloat(m[2]);
  let q = cleanQuad(m[3]);

  if (q) {
    if (q.length === 1) q = resolveSingleLetter(q, a);
    return { mode: InputMode.Azimuth, dip: b, azStrike: a, azDipQuad: q as Quadrant };
  }

  let mode: DefaultMode = defaultMode;
  if (mode === 'auto') mode = b > 90 ? InputMode.DipDipDir : InputMode.RHR;
  if (mode === InputMode.DipDipDir) return { mode, dip: a, ddDipDir: b };
  if (mode === InputMode.RHR) return { mode, dip: b, rhrStrike: a };
  if (mode === InputMode.Azimuth) throw new Error(`Azimuth notation needs a dip quadrant (e.g. 045/30SE): '${s}'`);
  throw new Error(`Quadrant notation needs N/S and E/W letters (e.g. N45E/30SE): '${s}'`);
};

// --- Row -> PlaneInput -------------------------------------------------------

export const rowToInput = (row: Record<string, unknown>, columns: string[], defaultMode: DefaultMode = 'auto'): PlaneInput => {
  const modeCol = findCol(columns, MODE_COLS);
  const mode: DefaultMode = (modeCol ? normMode(row[modeCol]) : undefined) ?? defaultMode;

  const notationCol = findCol(columns, NOTATION_COLS);
  if (notationCol && !isBlank(row[notationCol])) return parseNotation(String(row[notationCol]), mode);

  const strikeCol = findCol(columns, STRIKE_COLS);
  const dipCol = findCol(columns, DIP_COLS);
  const dipdirCol = findCol(columns, DIPDIR_COLS);
  const quadCol = findCol(columns, QUAD_COLS);

  const dip = dipCol ? toNum(row[dipCol]) : undefined;
  if (dip === undefined) throw new Error('Missing dip value');

  let quad = quadCol && !isBlank(row[quadCol]) ? String(row[quadCol]).trim().toUpperCase() : '';
  quad = cleanQuad(quad) ?? '';

  const strikeRaw = strikeCol ? row[strikeCol] : undefined;
  if (typeof strikeRaw === 'string' && /^\s*[NS]\s*\d/i.test(strikeRaw)) {
    return parseNotation(`${strikeRaw}/${dip}${quad}`, InputMode.Quadrant);
  }

  const strike = strikeCol ? toNum(row[strikeCol]) : undefined;
  const dipdir = dipdirCol ? toNum(row[dipdirCol]) : undefined;

  let resolved: DefaultMode = mode;
  if (resolved === 'auto') {
    resolved = dipdir !== undefined && strike === undefined ? InputMode.DipDipDir : quad ? InputMode.Azimuth : InputMode.RHR;
  }

  if (resolved === InputMode.DipDipDir) {
    if (dipdir === undefined) throw new Error('Missing dip direction (dipdir column)');
    return { mode: resolved, dip, ddDipDir: dipdir };
  }
  if (strike === undefined) throw new Error('Missing strike value');
  if (resolved === InputMode.RHR) return { mode: resolved, dip, rhrStrike: strike };
  if (resolved === InputMode.Azimuth) {
    if (!quad) throw new Error('Missing dip quadrant (quad column) for Azimuth mode');
    const q = quad.length === 1 ? resolveSingleLetter(quad, strike) : (quad as Quadrant);
    return { mode: resolved, dip, azStrike: strike, azDipQuad: q };
  }
  throw new Error("Quadrant mode needs a strike like 'N45E' (or a notation column)");
};

// --- Batch processing --------------------------------------------------------

export const processRows = (rows: Record<string, unknown>[], columns: string[], defaultMode: DefaultMode = 'auto'): BatchRow[] =>
  rows.map((source, index) => {
    try {
      const input = rowToInput(source, columns, defaultMode);
      const result = calculateConversion(input);
      return {
        index,
        source,
        inputMode: input.mode,
        result,
        illustratorStrike: result.isValid ? illustratorAngle(result.rhrStrike) : undefined,
        illustratorDipTick: result.isValid ? illustratorAngle(result.dipDirection) : undefined,
      };
    } catch (e) {
      return {
        index,
        source,
        inputMode: '',
        result: {
          isValid: false,
          error: (e as Error).message,
          rhrStrike: 0, dipDirection: 0, dip: 0,
          quadrantNotation: '---', azimuthNotation: '---', rhrNotation: '---', dipDipDirNotation: '---',
        },
      };
    }
  });

export const OUTPUT_COLUMNS = [
  'Input_Mode', 'Valid', 'Error', 'Quadrant', 'Azimuth', 'RHR', 'DipDipDir',
  'Strike_RHR', 'Dip', 'DipDir', 'Illustrator_Strike', 'Illustrator_DipTick',
] as const;

const r2 = (v?: number) => (v === undefined ? '' : Math.round(v * 100) / 100);

// Source columns first (copied as-is), then computed columns.
export const toOutputRows = (rows: BatchRow[], columns: string[]): Record<string, unknown>[] =>
  rows.map(({ source, inputMode, result, illustratorStrike, illustratorDipTick }) => {
    const out: Record<string, unknown> = {};
    for (const c of columns) out[c] = source[c] ?? '';
    const ok = result.isValid;
    Object.assign(out, {
      Input_Mode: inputMode,
      Valid: ok ? 'OK' : 'ERROR',
      Error: result.error ?? '',
      Quadrant: result.quadrantNotation,
      Azimuth: result.azimuthNotation,
      RHR: result.rhrNotation,
      DipDipDir: result.dipDipDirNotation,
      Strike_RHR: ok ? r2(result.rhrStrike) : '',
      Dip: ok ? r2(result.dip) : '',
      DipDir: ok ? r2(result.dipDirection) : '',
      Illustrator_Strike: r2(illustratorStrike),
      Illustrator_DipTick: r2(illustratorDipTick),
    });
    return out;
  });
