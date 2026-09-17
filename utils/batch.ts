import { CompassDir, Quadrant, InputMode, PlaneInput, ConversionResult } from '../types';
import { calculateConversion, normalize } from './geoMath';

// Batch parsing / conversion of tabular measurements.
// Mirrors python/geostrike_batch.py — keep both in sync.

/**
 * How the source spreadsheet is laid out. Each format has its own template.
 *  - auto        : free notation column ("N45E/30SE", "045/30", "30/135"...) or numeric columns, guessed per row
 *  - strike_sense: Strike 0-360 (any convention) + Dip + dip sense letter  -> azimuth, non-RHR
 *  - rhr         : Strike RHR 0-360 + Dip                                 -> RHR
 *  - dipdir      : Dip + Dip direction 0-360                              -> Dip/DipDir
 *  - quadrant    : Strike "N45E" + Dip + dip sense letter                 -> quadrant
 *  - strike180   : Strike 0-180 + Dip + optional dip sense (blank = RHR)  -> azimuth with/without RHR
 */
export type BatchFormat = 'auto' | 'strike_sense' | 'rhr' | 'dipdir' | 'quadrant' | 'strike180';
export const BATCH_FORMATS: BatchFormat[] = ['strike_sense', 'rhr', 'dipdir', 'quadrant', 'strike180', 'auto'];

/** Output column groups the user can pick. */
export type OutputGroup = 'quadrant' | 'azimuth' | 'rhr' | 'dipdir' | 'numeric' | 'illustrator';
export const OUTPUT_GROUPS: OutputGroup[] = ['quadrant', 'azimuth', 'rhr', 'dipdir', 'numeric', 'illustrator'];
const GROUP_COLUMNS: Record<OutputGroup, string[]> = {
  quadrant: ['Quadrant'],
  azimuth: ['Azimuth'],
  rhr: ['RHR'],
  dipdir: ['DipDipDir'],
  numeric: ['Strike_RHR', 'Dip', 'DipDir'],
  illustrator: ['Illustrator_Strike', 'Illustrator_DipTick'],
};
export const BASE_OUTPUT_COLUMNS = ['Input_Mode', 'Valid', 'Error'];
export const outputColumnsFor = (groups: OutputGroup[]): string[] =>
  [...BASE_OUTPUT_COLUMNS, ...OUTPUT_GROUPS.filter(g => groups.includes(g)).flatMap(g => GROUP_COLUMNS[g])];

/** Template columns per format (ID first, comment last — the comment is never touched). */
export const TEMPLATE_COLUMNS: Record<BatchFormat, string[]> = {
  strike_sense: ['ID', 'Strike', 'Dip', 'Sens_pendage', 'Commentaire'],
  rhr: ['ID', 'Strike_RHR', 'Dip', 'Commentaire'],
  dipdir: ['ID', 'Dip', 'DipDir', 'Commentaire'],
  quadrant: ['ID', 'Strike', 'Dip', 'Sens_pendage', 'Commentaire'],
  strike180: ['ID', 'Strike', 'Dip', 'Sens_pendage', 'Commentaire'],
  auto: ['ID', 'Mesure', 'Commentaire'],
};
export const TEMPLATE_EXAMPLES: Record<BatchFormat, Record<string, unknown>[]> = {
  strike_sense: [
    { ID: 'ST1', Strike: 45, Dip: 30, Sens_pendage: 'SE', Commentaire: 'Stratification' },
    { ID: 'ST2', Strike: 225, Dip: 30, Sens_pendage: 'NW', Commentaire: '' },
    { ID: 'ST3', Strike: 120, Dip: 60, Sens_pendage: 'S', Commentaire: 'Faille normale' },
  ],
  rhr: [
    { ID: 'ST1', Strike_RHR: 45, Dip: 30, Commentaire: 'Stratification' },
    { ID: 'ST2', Strike_RHR: 300, Dip: 75, Commentaire: '' },
  ],
  dipdir: [
    { ID: 'ST1', Dip: 30, DipDir: 135, Commentaire: 'Stratification' },
    { ID: 'ST2', Dip: 75, DipDir: 30, Commentaire: '' },
  ],
  quadrant: [
    { ID: 'ST1', Strike: 'N45E', Dip: 30, Sens_pendage: 'SE', Commentaire: 'Stratification' },
    { ID: 'ST2', Strike: 'S30W', Dip: 60, Sens_pendage: 'NW', Commentaire: '' },
  ],
  strike180: [
    { ID: 'ST1', Strike: 45, Dip: 30, Sens_pendage: 'SE', Commentaire: 'avec sens' },
    { ID: 'ST2', Strike: 45, Dip: 30, Sens_pendage: '', Commentaire: 'sans sens = RHR' },
    { ID: 'ST3', Strike: 120, Dip: 60, Sens_pendage: 'NE', Commentaire: '' },
  ],
  auto: [
    { ID: 'ST1', Mesure: 'N45E/30SE', Commentaire: 'quadrant' },
    { ID: 'ST2', Mesure: '045/30SE', Commentaire: 'azimut + sens' },
    { ID: 'ST3', Mesure: '045/30', Commentaire: 'RHR' },
    { ID: 'ST4', Mesure: '30/135', Commentaire: 'dip / dipdir' },
  ],
};

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
const STRIKE_COLS = ['strike', 'strike_rhr', 'direction', 'azimut', 'azimuth', 'az', 'quad_angle', 'angle'];
const DIP_COLS = ['dip', 'pendage', 'plunge'];
const DIPDIR_COLS = ['dipdir', 'dip_dir', 'dip_direction', 'dipdirection', 'direction_pendage', 'dir_pendage', 'dd'];
const SENSE_COLS = ['sens_pendage', 'sens_du_pendage', 'sens', 'sense', 'dip_sense', 'quad', 'quadrant', 'dip_quad', 'dipquad', 'dip_quadrant'];
const MODE_COLS = ['mode', 'format', 'notation_type', 'type'];

const normKey = (c: unknown) => String(c).trim().toLowerCase().replace(/\s+/g, '_');

const findCol = (columns: string[], candidates: string[]): string | undefined => {
  const lower = new Map(columns.map(c => [normKey(c), c]));
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

// Accepts NE/SE/SW/NW, single letters N/S/E/W, and French O (ouest) for W.
const cleanQuad = (q?: string): string | undefined => {
  if (!q) return undefined;
  const u = q.toUpperCase().replace(/O/g, 'W').replace(/[^NSEW]/g, '');
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

const quadrantStrikeToAz = (start: string, end: string, ang: number) =>
  start === 'N' && end === 'E' ? ang : start === 'S' && end === 'E' ? 180 - ang : start === 'S' && end === 'W' ? 180 + ang : 360 - ang;

export type DefaultMode = 'auto' | InputMode;

export const parseNotation = (text: string, defaultMode: DefaultMode = 'auto'): PlaneInput => {
  const s = String(text).trim();
  if (!s) throw new Error('Empty measurement');

  let m = s.match(RE_QUAD);
  if (m) {
    const start = m[1].toUpperCase() as CompassDir.N | CompassDir.S;
    const ang = parseFloat(m[2]);
    const end = m[3].toUpperCase() as CompassDir.E | CompassDir.W;
    const dip = parseFloat(m[4]);
    const az = quadrantStrikeToAz(start, end, ang);
    let q = cleanQuad(m[5]);
    if (!q) throw new Error(`Missing dip sense in '${s}'`);
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
  if (mode === InputMode.Azimuth) throw new Error(`Azimuth notation needs a dip sense (e.g. 045/30SE): '${s}'`);
  throw new Error(`Quadrant notation needs N/S and E/W letters (e.g. N45E/30SE): '${s}'`);
};

// --- Row -> PlaneInput -------------------------------------------------------

export const rowToInput = (row: Record<string, unknown>, columns: string[], format: BatchFormat = 'auto'): PlaneInput => {
  const strikeCol = findCol(columns, STRIKE_COLS);
  const dipCol = findCol(columns, DIP_COLS);
  const dipdirCol = findCol(columns, DIPDIR_COLS);
  const senseCol = findCol(columns, SENSE_COLS);
  const notationCol = findCol(columns, NOTATION_COLS);

  const dip = dipCol ? toNum(row[dipCol]) : undefined;
  const strikeRaw = strikeCol ? row[strikeCol] : undefined;
  const strike = toNum(strikeRaw);
  const dipdir = dipdirCol ? toNum(row[dipdirCol]) : undefined;
  const sense = senseCol && !isBlank(row[senseCol]) ? cleanQuad(String(row[senseCol])) : undefined;
  if (senseCol && !isBlank(row[senseCol]) && !sense) throw new Error(`Unrecognised dip sense '${String(row[senseCol])}' (use N, S, E, W, NE, SE, SW, NW)`);
  const isQuadStrike = typeof strikeRaw === 'string' && /^\s*[NS]\s*\d/i.test(strikeRaw);

  const needDip = () => { if (dip === undefined) throw new Error('Missing dip value'); return dip; };
  const needStrike = () => { if (strike === undefined) throw new Error('Missing strike value'); return strike; };

  const azimuthWithSense = (s: number, d: number, letter: string): PlaneInput => ({
    mode: InputMode.Azimuth, dip: d, azStrike: s, azDipQuad: letter.length === 1 ? resolveSingleLetter(letter, s) : (letter as Quadrant),
  });
  const quadrantFromRaw = (raw: string, d: number, letter?: string): PlaneInput => {
    const m = raw.match(/^\s*([NS])\s*(\d+(?:\.\d+)?)\s*([EW])\s*$/i);
    if (!m) throw new Error(`Unrecognised quadrant strike '${raw}' (expected e.g. N45E)`);
    if (!letter) throw new Error('Missing dip sense (Sens_pendage column) for quadrant format');
    const start = m[1].toUpperCase() as CompassDir.N | CompassDir.S;
    const ang = parseFloat(m[2]);
    const end = m[3].toUpperCase() as CompassDir.E | CompassDir.W;
    const az = quadrantStrikeToAz(start, end, ang);
    const q = letter.length === 1 ? resolveSingleLetter(letter, az) : (letter as Quadrant);
    return { mode: InputMode.Quadrant, dip: d, quadStart: start, quadAngle: ang, quadEnd: end, quadDipQuad: q };
  };

  switch (format) {
    case 'strike_sense': {
      const d = needDip(); const s = needStrike();
      if (!sense) throw new Error('Missing dip sense (Sens_pendage column): required for non-RHR strike');
      return azimuthWithSense(s, d, sense);
    }
    case 'rhr': {
      const d = needDip(); const s = needStrike();
      return { mode: InputMode.RHR, dip: d, rhrStrike: s };
    }
    case 'dipdir': {
      const d = needDip();
      if (dipdir === undefined) throw new Error('Missing dip direction (DipDir column)');
      return { mode: InputMode.DipDipDir, dip: d, ddDipDir: dipdir };
    }
    case 'quadrant': {
      const d = needDip();
      if (typeof strikeRaw !== 'string' || !isQuadStrike) throw new Error(`Strike must be a quadrant bearing like N45E (got '${String(strikeRaw ?? '')}')`);
      return quadrantFromRaw(strikeRaw, d, sense);
    }
    case 'strike180': {
      const d = needDip(); const s = needStrike();
      if (s > 180) throw new Error(`Strike ${s} is outside 0-180 (use the 0-360 + dip sense format)`);
      return sense ? azimuthWithSense(s, d, sense) : { mode: InputMode.RHR, dip: d, rhrStrike: s };
    }
    default: break;
  }

  // ---- auto: per-row detection -------------------------------------------
  const modeCol = findCol(columns, MODE_COLS);
  const mode: DefaultMode = (modeCol ? normMode(row[modeCol]) : undefined) ?? 'auto';

  if (notationCol && !isBlank(row[notationCol])) return parseNotation(String(row[notationCol]), mode);

  const d = needDip();
  if (isQuadStrike) return quadrantFromRaw(strikeRaw as string, d, sense);

  let resolved: DefaultMode = mode;
  if (resolved === 'auto') {
    resolved = dipdir !== undefined && strike === undefined ? InputMode.DipDipDir : sense ? InputMode.Azimuth : InputMode.RHR;
  }
  if (resolved === InputMode.DipDipDir) {
    if (dipdir === undefined) throw new Error('Missing dip direction (DipDir column)');
    return { mode: resolved, dip: d, ddDipDir: dipdir };
  }
  const s = needStrike();
  if (resolved === InputMode.RHR) return { mode: resolved, dip: d, rhrStrike: s };
  if (resolved === InputMode.Azimuth) {
    if (!sense) throw new Error('Missing dip sense (Sens_pendage column) for Azimuth mode');
    return azimuthWithSense(s, d, sense);
  }
  throw new Error("Quadrant mode needs a strike like 'N45E' (or a Mesure column)");
};

// --- Batch processing --------------------------------------------------------

export const processRows = (rows: Record<string, unknown>[], columns: string[], format: BatchFormat = 'auto'): BatchRow[] =>
  rows.map((source, index) => {
    try {
      const input = rowToInput(source, columns, format);
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

const r2 = (v?: number) => (v === undefined ? '' : Math.round(v * 100) / 100);

// Source columns first (copied as-is, comments included), then the selected computed columns.
export const toOutputRows = (rows: BatchRow[], columns: string[], outputCols: string[]): Record<string, unknown>[] =>
  rows.map(({ source, inputMode, result, illustratorStrike, illustratorDipTick }) => {
    const out: Record<string, unknown> = {};
    for (const c of columns) out[c] = source[c] ?? '';
    const ok = result.isValid;
    const all: Record<string, unknown> = {
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
    };
    // Never overwrite a source column (e.g. a template "Dip" column): suffix the computed one.
    for (const c of outputCols) out[columns.includes(c) ? `${c}_conv` : c] = all[c];
    return out;
  });
