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

The **Plusieurs mesures / Batch** page is a 4-step flow:

1. **Source data format** — pick how your measurements are written:
   `strike_sense` (Strike 0-360 + Dip + Sens_pendage, non-RHR), `rhr` (Strike_RHR + Dip),
   `dipdir` (Dip + DipDir), `quadrant` (N45E + Dip + Sens_pendage),
   `strike180` (Strike 0-180 + Dip, sense optional: with sense = azimuth, without = RHR),
   or `auto` (free-text `Mesure` column such as `N45E/30SE`, `045/30`, `30/135`).
2. **Template** — download the matching `.xlsx` (`ID | … | Commentaire`). The Commentaire
   column and any extra column are copied unchanged to the export.
3. **Import** — `.xlsx` / `.csv` (UTF-8 or Windows-1252), or paste a list.
4. **Outputs** — tick the formats to append (Quadrant, Azimuth, RHR, Dip/DipDir, numeric
   values, Illustrator angles) and export as Excel or CSV.

The UI is available in French and English (toggle in the header).

### Python version

`python/geostrike_batch.py` is a standalone port of the same formulas and formats:

```bash
pip install pandas openpyxl
python python/geostrike_batch.py mesures.xlsx --format strike_sense   # -> mesures_converted.xlsx
python python/geostrike_batch.py mesures.csv -o out.csv --format rhr --outputs quadrant,dipdir
```

Tests: `python -m pytest python/`. Sample input: `python/exemple_mesures.xlsx`.
