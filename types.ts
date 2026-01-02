export enum CompassDir {
  N = 'N',
  S = 'S',
  E = 'E',
  W = 'W',
}

export enum Quadrant {
  NE = 'NE',
  SE = 'SE',
  SW = 'SW',
  NW = 'NW',
}

export enum InputMode {
  Quadrant = 'Quadrant',
  Azimuth = 'Azimuth',
  RHR = 'RHR',
  DipDipDir = 'DipDipDir',
}

export interface PlaneInput {
  mode: InputMode;
  // Quadrant specific
  quadStart?: CompassDir.N | CompassDir.S;
  quadAngle?: number;
  quadEnd?: CompassDir.E | CompassDir.W;
  quadDipQuad?: Quadrant;
  
  // Azimuth specific
  azStrike?: number;
  azDipQuad?: Quadrant;

  // RHR specific
  rhrStrike?: number;

  // DipDipDir specific
  ddDipDir?: number;

  // Common
  dip?: number;
}

export interface ConversionResult {
  isValid: boolean;
  error?: string;
  // Computed values for visualization
  rhrStrike: number;
  dipDirection: number;
  dip: number;
  
  // Display strings
  quadrantNotation: string;      // N45E/25SE
  azimuthNotation: string;       // 045/25SE
  rhrNotation: string;           // 045/25
  dipDipDirNotation: string;     // 25/135
}
