
import { CompassDir, Quadrant, InputMode, PlaneInput, ConversionResult } from '../types';

// --- Helpers ---

export const format3 = (val: number): string => Math.round(val).toString().padStart(3, '0');
export const format2 = (val: number): string => Math.round(val).toString().padStart(2, '0');

export const normalize = (angle: number): number => {
  let res = angle % 360;
  if (res < 0) res += 360;
  if (res === 360 || Math.abs(res) < 0.0001) res = 0;
  return res;
};

// Check if an angle is within a quadrant
const isAngleInQuad = (angle: number, q: Quadrant): boolean => {
  const norm = normalize(angle);
  // Relaxed boundaries for edge cases
  switch (q) {
    case Quadrant.NE: return (norm >= 0 && norm <= 90);
    case Quadrant.SE: return (norm >= 90 && norm <= 180);
    case Quadrant.SW: return (norm >= 180 && norm <= 270);
    case Quadrant.NW: return (norm >= 270 || norm === 0);
  }
  return false;
};

// Get Quadrant string from Azimuth
const getQuadFromAzimuth = (angle: number): Quadrant => {
  const norm = normalize(angle);
  if (norm > 0 && norm <= 90) return Quadrant.NE;
  if (norm > 90 && norm <= 180) return Quadrant.SE;
  if (norm > 180 && norm <= 270) return Quadrant.SW;
  return Quadrant.NW; // 270-360/0
};

// --- Conversion Logic ---

// Internal normalized plane
interface RHRPlane {
  strike: number; // RHR Strike
  dip: number;
  dipDir: number;
}

const getPlaneFromInput = (input: PlaneInput): { plane?: RHRPlane; error?: string } => {
  const dip = input.dip ?? 0;

  // Global validation
  if (dip < 0 || dip > 90) {
    return { error: 'Dip angle must be between 0 and 90 degrees.' };
  }
  
  // 1. Dip/DipDir Mode
  if (input.mode === InputMode.DipDipDir) {
    const dd = input.ddDipDir ?? 0;
    if (dd < 0 || dd > 360) {
      return { error: 'Dip direction must be between 0 and 360 degrees.' };
    }
    const strike = normalize(dd - 90);
    return { plane: { strike, dip, dipDir: normalize(dd) } };
  }

  // 2. RHR Mode
  if (input.mode === InputMode.RHR) {
    const strike = input.rhrStrike ?? 0;
    if (strike < 0 || strike > 360) {
      return { error: 'RHR strike must be between 0 and 360 degrees.' };
    }
    const dipDir = normalize(strike + 90);
    return { plane: { strike: normalize(strike), dip, dipDir } };
  }

  // 3. Azimuth Mode
  if (input.mode === InputMode.Azimuth) {
    const azStrike = input.azStrike ?? 0;
    if (azStrike < 0 || azStrike > 360) {
      return { error: 'Strike azimuth must be between 0 and 360 degrees.' };
    }
    const q = input.azDipQuad || Quadrant.SE;
    
    const cand1 = normalize(azStrike + 90); // Right
    const cand2 = normalize(azStrike - 90); // Left

    if (isAngleInQuad(cand1, q)) {
      return { plane: { strike: normalize(azStrike), dip, dipDir: cand1 } };
    } else if (isAngleInQuad(cand2, q)) {
      return { plane: { strike: normalize(azStrike + 180), dip, dipDir: cand2 } };
    } else {
      return { error: `Dip quadrant ${q} is not perpendicular to strike ${format3(azStrike)}.` };
    }
  }

  // 4. Quadrant Mode
  if (input.mode === InputMode.Quadrant) {
    const ang = input.quadAngle ?? 0;
    if (ang < 0 || ang > 90) {
      return { error: 'Quadrant angle must be between 0 and 90 degrees.' };
    }

    // First convert Quadrant Strike to Azimuth Strike
    let az = 0;
    const start = input.quadStart || CompassDir.N;
    const end = input.quadEnd || CompassDir.E;
    
    if (start === CompassDir.N && end === CompassDir.E) az = ang;
    else if (start === CompassDir.S && end === CompassDir.E) az = 180 - ang;
    else if (start === CompassDir.S && end === CompassDir.W) az = 180 + ang;
    else if (start === CompassDir.N && end === CompassDir.W) az = 360 - ang;
    
    az = normalize(az);
    const q = input.quadDipQuad || Quadrant.SE;

    // Same logic as Azimuth mode
    const cand1 = normalize(az + 90);
    const cand2 = normalize(az - 90);

    if (isAngleInQuad(cand1, q)) {
      return { plane: { strike: normalize(az), dip, dipDir: cand1 } };
    } else if (isAngleInQuad(cand2, q)) {
      return { plane: { strike: normalize(az + 180), dip, dipDir: cand2 } };
    } else {
      return { error: `Dip quadrant ${q} is not perpendicular to strike ${start}${format2(ang)}${end} (Az: ${format3(az)}).` };
    }
  }

  return { error: 'Unknown mode' };
};


// --- Output Formatting ---

export const calculateConversion = (input: PlaneInput): ConversionResult => {
  const { plane, error } = getPlaneFromInput(input);

  if (error || !plane) {
    return {
      isValid: false,
      error,
      rhrStrike: 0,
      dipDirection: 0,
      dip: 0,
      quadrantNotation: '---',
      azimuthNotation: '---',
      rhrNotation: '---',
      dipDipDirNotation: '---',
    };
  }

  const { strike, dip, dipDir } = plane;

  // 1. RHR Notation
  const rhrNotation = `${format3(strike)}/${format2(dip)}`;

  // 2. Dip/DipDir Notation
  const dipDipDirNotation = `${format2(dip)}/${format3(dipDir)}`;

  // 3. Azimuth Notation (Using RHR strike + explicit quad)
  const dipQuad = getQuadFromAzimuth(dipDir);
  const azimuthNotation = `${format3(strike)}/${format2(dip)}${dipQuad}`;

  // 4. Quadrant Notation
  // Convert RHR strike to N/S E/W
  let quadStr = '';
  // Normalized strike is 0-359
  if (strike >= 0 && strike <= 90) {
    quadStr = `N${format2(strike)}E`;
  } else if (strike > 90 && strike <= 180) {
    quadStr = `S${format2(180 - strike)}E`;
  } else if (strike > 180 && strike <= 270) {
    quadStr = `S${format2(strike - 180)}W`;
  } else {
    quadStr = `N${format2(360 - strike)}W`;
  }
  const quadrantNotation = `${quadStr}/${format2(dip)}${dipQuad}`;

  return {
    isValid: true,
    rhrStrike: strike,
    dipDirection: dipDir,
    dip,
    quadrantNotation,
    azimuthNotation,
    rhrNotation,
    dipDipDirNotation,
  };
};
