<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1oF04VaxbHlLIJW_P7NvSS-CdJll5K8T9

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Batch conversion (Excel / CSV)

The web app has a **Batch Conversion** section: import a `.xlsx` / `.csv` list of
measurements (or paste one per line), convert everything at once and export the
result as Excel or CSV. A template can be downloaded from the page.

Recognised columns (case-insensitive): `Mesure` / `notation` (e.g. `N45E/30SE`,
`045/30SE`, `045/30`, `30/135`) **or** `strike`, `dip`, `dipdir`, `quad`, plus an
optional `mode` (`Quadrant`, `Azimuth`, `RHR`, `DipDipDir`). Every other column
(station, lithology, X/Y…) is copied unchanged into the export.

Output columns: `Input_Mode, Valid, Error, Quadrant, Azimuth, RHR, DipDipDir,
Strike_RHR, Dip, DipDir, Illustrator_Strike, Illustrator_DipTick`.

### Python version

`python/geostrike_batch.py` is a standalone port of the same formulas:

```bash
pip install pandas openpyxl
python python/geostrike_batch.py mesures.xlsx              # -> mesures_converted.xlsx
python python/geostrike_batch.py mesures.csv -o out.csv --mode RHR
```

Tests: `python -m pytest python/`. Sample input: `python/exemple_mesures.xlsx`.
