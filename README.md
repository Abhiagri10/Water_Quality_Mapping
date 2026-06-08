# Water Quality Mapping — Pathum Thani, Thailand

**Near Real-Time Water Quality Monitoring with High-Resolution Satellite Images and Machine Learning Methods**

This repository contains the Google Earth Engine (GEE) JavaScript mapping scripts for eight water quality parameters (WQPs) in the Chao Phraya River and Khlong Nueng canal, Pathum Thani Province, Thailand. Scripts train Random Forest regression models on in-situ field data paired with Landsat 8/9 spectral indices, then predict monthly spatiotemporal WQP maps for 2024.

---

## Repository Structure

```
Water_Quality_Mapping/
├── README.md
├── LICENSE
├── .gitignore
└── GEE_scripts/
    ├── Optically_Active_WQPs/
    │   ├── Turbidity_Mapping_v1.js
    │   ├── EC_Mapping_v1.js
    │   ├── Salinity_Mapping_v1.js
    │   ├── TDS_Mapping_v1.js
    │   └── Temperature_Mapping_v1.js
    └── Optically_Inactive_WQPs/
        ├── DO_Mapping_v1.js
        ├── TP_Mapping_v1.js
        └── pH_Mapping_v1.js
```

---

## Study Area

Pathum Thani Province, Central Thailand (13.91°N–14.14°N, 100.49°E–100.79°E).
Three sampling zones: Talad Thai (Zone 1, 3 stations), Khlong Bang Luang (Zone 2, 4 stations), Ban Phrao (Zone 3, 4 stations). Satellite data: Landsat 8 + 9 Collection 2 Tier 1 SR, 22 acquisition dates spanning 21 June 2024 – 7 January 2025.

---

## Requirements

### GEE

- A Google Earth Engine account (https://earthengine.google.com)
- GEE project with write access (scripts use `projects/ee-st124278/assets/WQ_Combined/`)
- User-defined polygon FeatureCollections in GEE:
  - `Chao_Phraya` — polygon geometry of the Chao Phraya River study reach
  - `Khlong_Nueng` — polygon geometry of the Khlong Nueng canal study reach

### Python (for performance-metrics notebooks, hosted separately)

- Python 3.10+
- `pandas`, `numpy`, `scikit-learn`, `matplotlib`, `scipy`

---

## Running the GEE Scripts

### Step 1 — Accept the GEE repository

Open the link below in a browser while signed into your GEE account:

```
https://code.earthengine.google.com/?accept_repo=users/abshirodkar15/Water_Quality_Mapping
```

This adds the scripts directly to your GEE Code Editor under **Reader** repositories.

### Step 2 — Set up your water body assets

Before running any script, define your study water body polygons as GEE assets and import them at the top of each script:

```javascript
var Chao_Phraya = ee.FeatureCollection('projects/YOUR_PROJECT/assets/Chao_Phraya');
var Khlong_Nueng = ee.FeatureCollection('projects/YOUR_PROJECT/assets/Khlong_Nueng');
```

### Step 3 — Load the in-situ asset

Each script references a GEE FeatureCollection asset for the corresponding WQP (e.g., `turbidityCombined`). Update the asset path to match your GEE project:

```javascript
var turbidityCombined = ee.FeatureCollection('projects/YOUR_PROJECT/assets/WQ_Combined/Turbidity_Combined');
```

### Step 4 — Run the script

Paste or open the script in the GEE Code Editor and click **Run**. The Console will print training/validation/testing set sizes and performance metrics. The Map panel will display the July 2024 monthly mean prediction for both water bodies.

### Step 5 — Optional: Export GeoTIFFs

Each script contains a commented-out `Export.image.toDrive()` block. To generate monthly GeoTIFF outputs, uncomment the block in the relevant script and click **Run** → then submit each task in the **Tasks** panel.

```javascript
// EXPORT — Uncomment to generate monthly GeoTIFFs in Google Drive
/*
Export.image.toDrive({...});
*/
```

---

## Script Parameters and Published Performance

| Script | Parameter | Unit | RF Trees | Split (tr/val/te) | R² Train | R² Val | R² Test |
|---|---|---|---|---|---|---|---|
| Turbidity_Mapping_v1.js | Turbidity | NTU | 100 | 0.65 / 0.86 | 0.783 | 0.592 | 0.814 |
| EC_Mapping_v1.js | EC | µS/cm | 100 | 0.82 / 0.92 | — | — | — |
| Salinity_Mapping_v1.js | Salinity | ppm | 500 | 0.84 / 0.89 | — | — | — |
| TDS_Mapping_v1.js | TDS | mg/L | 100 | 0.71 / 0.92 | — | — | — |
| Temperature_Mapping_v1.js | Temperature | °C | 100 | 0.65 / 0.86 | 0.717 | 0.173 | 0.339 |
| DO_Mapping_v1.js | DO | mg/L | 100 | 0.65 / 0.86 | 0.831 | 0.812 | 0.746 |
| TP_Mapping_v1.js | TP | mg/L | 100 | 0.80 / 0.94 | 0.788 | 0.846 | 0.721 |
| pH_Mapping_v1.js | pH | — | 100 | 0.65 / 0.86 | 0.825 | 0.682 | 0.506 |

> Published metrics are sourced from the thesis-verified prediction CSVs. Model re-runs in GEE will produce different values due to the unseeded random split in the original thesis runs.

---

## Important Notes on Optically Inactive WQPs (DO, TP, pH)

DO, TP, and pH use a **hybrid modelling approach**: spectral indices from Landsat are combined with in-situ TDS and Turbidity values as additional features during training. During spatiotemporal prediction over unmeasured areas, training-set mean values are used as constant fallback inputs for TDS and Turbidity. This is the design validated in the thesis and should not be altered without re-validating the feature set.

---

## Citation

> Abhishek Shirodkar (2025). *Near Real-Time Water Quality Monitoring with High-Resolution Satellite Images and Machine Learning Methods*. Master's Thesis, [University Name]. Zenodo DOI: [TBD]

If you use these scripts in your research, please cite the thesis above and the following Landsat data source:

> U.S. Geological Survey (2023). Landsat Collection 2 Level-2 Science Products. https://doi.org/10.5066/P9OGBGM6

---

## License

MIT License — see [LICENSE](LICENSE) for details.
