import React, { createContext, useContext, useEffect, useState } from 'react';

export type Lang = 'fr' | 'en';

const fr = {
  // header / nav
  tagline: 'Convertisseur structural universel',
  nav_home: 'Accueil',
  nav_single: 'Une mesure',
  nav_batch: 'Plusieurs mesures',
  back_home: 'Retour à l’accueil',

  // home
  home_title: 'Convertissez vos mesures structurales',
  home_subtitle: 'Quadrant, Azimut, RHR, Dip / Dip direction et angles Illustrator — pour une mesure ou pour tout un carnet de terrain.',
  card_single_kicker: 'Une mesure',
  card_single_title: 'Convertir ou vérifier une mesure',
  card_single_desc: 'Saisissez une mesure, contrôlez sa cohérence géométrique et obtenez instantanément les quatre notations et la projection stéréographique.',
  card_single_cta: 'Ouvrir le convertisseur',
  card_batch_kicker: 'Plusieurs mesures',
  card_batch_title: 'Convertir une liste depuis Excel ou CSV',
  card_batch_desc: 'Téléchargez le modèle adapté à vos données de départ, remplissez vos colonnes Strike / Dip / Sens du pendage / Commentaire, importez et exportez le résultat.',
  card_batch_cta: 'Importer un fichier',
  formats_title: 'Notations gérées',
  fmt_quadrant: 'Direction N/S θ E/W et sens de pendage général.',
  fmt_azimuth: 'Direction 0–360° et sens de pendage général.',
  fmt_rhr: 'Règle de la main droite : le pendage est à droite de la direction.',
  fmt_dipdir: 'Pendage et azimut de la ligne de plus grande pente.',

  // single converter
  single_title: 'Convertir / vérifier une mesure',
  manual_title: 'Saisie manuelle',
  manual_subtitle: 'Choisissez la notation d’entrée puis ajustez les valeurs',
  strike_quadrant: 'Direction (quadrant)',
  strike_azimuth: 'Direction azimutale (0–360°)',
  strike_rhr: 'Direction RHR (0–360°)',
  dip_direction: 'Direction de pendage (0–360°)',
  dip_angle: 'Pendage (0–90°)',
  dip_quadrant: 'Sens du pendage',
  status_valid: 'Mesure valide',
  status_valid_desc: 'La direction et le sens de pendage sont perpendiculaires.',
  status_error: 'Erreur de contrainte géométrique',
  results_title: 'Notations générées',
  res_quadrant_desc: 'Direction Pendage/Sens',
  res_azimuth_desc: 'Az/Pendage+Sens',
  res_rhr_desc: 'Direction/Pendage standard',
  res_dipdir_desc: 'Notation vectorielle',
  illustrator_title: 'Angles Adobe Illustrator',
  illustrator_strike: 'Ligne de direction',
  illustrator_dip: 'Tick de pendage',
  illustrator_desc: '0° = Est, sens antihoraire',
  stereo_title: 'Projection stéréographique',
  stereo_desc: 'Projection équi-angle (Wulff) • Hémisphère inférieur',
  ai_title: 'Gemini Intelligence',
  ai_subtitle: 'Analyse de texte libre',
  ai_placeholder: 'Collez un texte brut ici… (ex. N12W 45SW)',
  ai_parse: 'Analyser',
  ai_hint: 'L’IA détecte le format et remplit les champs ci-dessus.',
  ai_error: 'Impossible d’analyser le texte. Essayez un autre format (ex. « N45E 30SE »).',

  // batch
  batch_title: 'Convertir plusieurs mesures',
  batch_subtitle: 'Quatre étapes : type de données → modèle → import → export.',
  step1: 'Type de données de départ',
  step1_hint: 'Choisissez comment vos mesures sont notées. Le modèle et la lecture des colonnes s’adaptent.',
  step2: 'Modèle Excel',
  step2_hint: 'Remplissez le modèle : une ligne par mesure. La colonne Commentaire (et toute colonne supplémentaire) est recopiée telle quelle dans l’export.',
  step2_download: 'Télécharger le modèle',
  step2_columns: 'Colonnes attendues',
  step3: 'Importer vos mesures',
  step3_hint: 'Fichier .xlsx ou .csv rempli à partir du modèle. Ou collez une liste pour un test rapide.',
  step3_button: 'Choisir un fichier',
  step3_drop: 'ou glissez-déposez un fichier .xlsx / .csv ici',
  step3_paste: 'Ou collez une liste (une mesure par ligne)',
  step3_paste_btn: 'Convertir la liste',
  step4: 'Formats de sortie et export',
  step4_hint: 'Les colonnes cochées sont ajoutées à droite de vos colonnes d’origine.',
  out_quadrant: 'Quadrant',
  out_azimuth: 'Azimut + sens',
  out_rhr: 'RHR',
  out_dipdir: 'Dip / DipDir',
  out_numeric: 'Valeurs numériques',
  out_illustrator: 'Angles Illustrator',
  export_xlsx: 'Exporter Excel',
  export_csv: 'Exporter CSV',
  clear: 'Effacer',
  rows: 'lignes',
  ok: 'OK',
  errors: 'erreurs',
  showing_first: 'aperçu des {n} premières',
  empty_file: 'Le fichier est vide ou n’a pas de ligne d’en-tête.',
  read_error: 'Lecture impossible :',
  pasted_list: 'liste collée',

  // batch formats
  bf_strike_sense: 'Strike 0–360 + Dip + Sens du pendage',
  bf_strike_sense_d: 'Azimut « sans RHR » : la direction est mesurée librement, le sens (N, S, E, W, NE…) lève l’ambiguïté.',
  bf_rhr: 'Azimut RHR (Strike + Dip)',
  bf_rhr_d: 'Règle de la main droite : le pendage est toujours à droite, aucun sens à saisir.',
  bf_dipdir: 'Dip + Dip direction',
  bf_dipdir_d: 'Pendage et azimut de la ligne de plus grande pente (ex. 30 / 135).',
  bf_quadrant: 'Quadrant (N45E) + Dip + Sens',
  bf_quadrant_d: 'Direction en quadrant (N45E, S30W…), pendage et sens du pendage.',
  bf_strike180: 'Strike 0–180 + Dip, sens facultatif',
  bf_strike180_d: 'Direction limitée à 0–180. Avec sens = azimut ; sans sens = RHR.',
  bf_auto: 'Détection automatique',
  bf_auto_d: 'Colonne « Mesure » en texte libre (N45E/30SE, 045/30, 30/135…) ou colonnes mixtes.',
};

const en: typeof fr = {
  tagline: 'Universal Structural Converter',
  nav_home: 'Home',
  nav_single: 'Single measurement',
  nav_batch: 'Batch',
  back_home: 'Back to home',

  home_title: 'Convert your structural measurements',
  home_subtitle: 'Quadrant, Azimuth, RHR, Dip / Dip direction and Illustrator angles — for one measurement or a whole field notebook.',
  card_single_kicker: 'One measurement',
  card_single_title: 'Convert or check a measurement',
  card_single_desc: 'Enter a measurement, check its geometric consistency and instantly get all four notations plus the stereographic projection.',
  card_single_cta: 'Open the converter',
  card_batch_kicker: 'Many measurements',
  card_batch_title: 'Convert a list from Excel or CSV',
  card_batch_desc: 'Download the template matching your source data, fill in Strike / Dip / Dip sense / Comment, import and export the result.',
  card_batch_cta: 'Import a file',
  formats_title: 'Supported notations',
  fmt_quadrant: 'N/S θ E/W strike with general dip sense.',
  fmt_azimuth: '0–360° strike with general dip sense.',
  fmt_rhr: 'Right-hand rule: dip is to the right of the strike.',
  fmt_dipdir: 'Dip angle and azimuth of the steepest-descent line.',

  single_title: 'Convert / check a measurement',
  manual_title: 'Manual input',
  manual_subtitle: 'Pick the input notation, then adjust the values',
  strike_quadrant: 'Strike (quadrant)',
  strike_azimuth: 'Strike azimuth (0–360°)',
  strike_rhr: 'RHR strike (0–360°)',
  dip_direction: 'Dip direction (0–360°)',
  dip_angle: 'Dip angle (0–90°)',
  dip_quadrant: 'Dip sense',
  status_valid: 'Valid measurement',
  status_valid_desc: 'Strike and dip sense are perpendicular.',
  status_error: 'Geometric constraint error',
  results_title: 'Generated notations',
  res_quadrant_desc: 'Strike Dip/Sense',
  res_azimuth_desc: 'Az/Dip+Sense',
  res_rhr_desc: 'Standard Strike/Dip',
  res_dipdir_desc: 'Vector notation',
  illustrator_title: 'Adobe Illustrator angles',
  illustrator_strike: 'Strike line',
  illustrator_dip: 'Dip tick',
  illustrator_desc: '0° = East, counterclockwise',
  stereo_title: 'Stereographic projection',
  stereo_desc: 'Equal angle (Wulff) • Lower hemisphere',
  ai_title: 'Gemini Intelligence',
  ai_subtitle: 'Natural text parsing',
  ai_placeholder: 'Paste raw text here… (e.g. N12W 45SW)',
  ai_parse: 'Parse',
  ai_hint: 'AI detects the format and fills the fields above.',
  ai_error: 'Could not parse the text. Try another format (e.g. "N45E 30SE").',

  batch_title: 'Convert many measurements',
  batch_subtitle: 'Four steps: source format → template → import → export.',
  step1: 'Source data format',
  step1_hint: 'Tell us how your measurements are written. The template and the column reader adapt.',
  step2: 'Excel template',
  step2_hint: 'Fill the template, one row per measurement. The Comment column (and any extra column) is copied unchanged to the export.',
  step2_download: 'Download template',
  step2_columns: 'Expected columns',
  step3: 'Import your measurements',
  step3_hint: 'A .xlsx or .csv file based on the template. Or paste a list for a quick test.',
  step3_button: 'Choose a file',
  step3_drop: 'or drag & drop a .xlsx / .csv file here',
  step3_paste: 'Or paste a list (one measurement per line)',
  step3_paste_btn: 'Convert the list',
  step4: 'Output formats and export',
  step4_hint: 'Checked columns are appended to the right of your original columns.',
  out_quadrant: 'Quadrant',
  out_azimuth: 'Azimuth + sense',
  out_rhr: 'RHR',
  out_dipdir: 'Dip / DipDir',
  out_numeric: 'Numeric values',
  out_illustrator: 'Illustrator angles',
  export_xlsx: 'Export Excel',
  export_csv: 'Export CSV',
  clear: 'Clear',
  rows: 'rows',
  ok: 'OK',
  errors: 'errors',
  showing_first: 'showing first {n}',
  empty_file: 'The file is empty or has no header row.',
  read_error: 'Could not read file:',
  pasted_list: 'pasted list',

  bf_strike_sense: 'Strike 0–360 + Dip + Dip sense',
  bf_strike_sense_d: 'Non-RHR azimuth: strike measured freely, the sense letter (N, S, E, W, NE…) removes the ambiguity.',
  bf_rhr: 'RHR azimuth (Strike + Dip)',
  bf_rhr_d: 'Right-hand rule: dip is always to the right, no sense needed.',
  bf_dipdir: 'Dip + Dip direction',
  bf_dipdir_d: 'Dip angle and azimuth of the steepest-descent line (e.g. 30 / 135).',
  bf_quadrant: 'Quadrant (N45E) + Dip + Sense',
  bf_quadrant_d: 'Quadrant strike (N45E, S30W…), dip and dip sense.',
  bf_strike180: 'Strike 0–180 + Dip, optional sense',
  bf_strike180_d: 'Strike limited to 0–180. With a sense = azimuth; without = RHR.',
  bf_auto: 'Auto-detect',
  bf_auto_d: 'Free-text "Mesure" column (N45E/30SE, 045/30, 30/135…) or mixed columns.',
};

export type TKey = keyof typeof fr;
const DICT: Record<Lang, typeof fr> = { fr, en };

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey, vars?: Record<string, string | number>) => string }
const LangContext = createContext<Ctx>({ lang: 'fr', setLang: () => {}, t: k => fr[k] });

const readStoredLang = (): Lang => {
  try {
    const v = localStorage.getItem('geostrike.lang');
    if (v === 'fr' || v === 'en') return v;
  } catch { /* ignore */ }
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'fr';
};

export const LangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>(readStoredLang);
  useEffect(() => {
    try { localStorage.setItem('geostrike.lang', lang); } catch { /* ignore */ }
    document.documentElement.lang = lang;
  }, [lang]);
  const t = (k: TKey, vars?: Record<string, string | number>) => {
    let s = DICT[lang][k] ?? fr[k];
    if (vars) for (const [key, val] of Object.entries(vars)) s = s.replace(`{${key}}`, String(val));
    return s;
  };
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
};

export const useT = () => useContext(LangContext);
