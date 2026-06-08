# Near Real-Time Water Quality Mapping Using Landsat and Random Forest

**A GEE & Python Framework**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Google%20Earth%20Engine-green)](https://earthengine.google.com/)
[![Python 3](https://img.shields.io/badge/Python-3.x-blue)](Python_Colab_Scripts/)
[![GEE Repo](https://img.shields.io/badge/GEE%20Repo-accept%20link-orange)](https://code.earthengine.google.com/?accept_repo=users/abshirodkar15/Water_Quality_Mapping)

---

## Overview

This repository provides a reproducible framework for estimating water quality parameters from Landsat 8/9 surface reflectance imagery using Random Forest regression. The workflow was developed and validated in Pathum Thani Province, Thailand, along the Chao Phraya River and Khlong Nueng canal, using 22 acquisition dates (June 2024 to January 2025) and 11 in-situ monitoring stations across three zones. The code transfers directly to other study areas: replace the GEE asset path, update the sampling coordinates and acquisition dates, and the full pipeline runs without structural changes.

Spatial prediction and model development are kept separate. GEE JavaScript scripts handle image access, spectral index computation, and monthly spatial prediction. Python/Colab notebooks cover model training, metric reporting, and diagnostic scatter plots for EC, Salinity, and TDS. This separation follows the pattern used by SERVIR and the GEE Community and keeps each component independently reusable. The repository also includes GEE mapping scripts for three optically inactive parameters (DO, TP, pH) trained with a hybrid spectral and in-situ feature approach.

---

## Repository Structure

```
Water_Quality_Mapping/
├── README.md
├── LICENSE
├── .gitignore
├── requirements.txt
│
├── GEE_Scripts/                                        # Spatial mapping and monthly prediction
│   ├── Optically_Active_WQPs/
│   │   ├── Turbidity_Mapping_v1.js
│   │   ├── EC_Mapping_v1.js
│   │   ├── Salinity_Mapping_v1.js
│   │   ├── TDS_Mapping_v1.js
│   │   └── Temperature_Mapping_v1.js
│   └── Optically_Inactive_WQPs/
│       ├── DO_Mapping_v1.js
│       ├── TP_Mapping_v1.js
│       └── pH_Mapping_v1.js
│
├── Machine_Learning_Water_Quality/                     # ML training, metrics, and validation
│   └── Random_Forest/
│       └── Optically_Active_WQPs/
│           ├── Turbidity_ML_RF_v1.js
│           ├── EC_ML_RF_v1.js
│           ├── Salinity_ML_RF_v1.js
│           ├── TDS_ML_RF_v1.js
│           └── Temperature_ML_RF_v1.js
│
├── Python_Colab_Scripts/                               # Python notebooks for EC, Salinity, TDS
│   ├── EC_RF_v1.ipynb
│   ├── Salinity_RF_v1.ipynb
│   └── TDS_RF_v1.ipynb
│
└── prediction_csvs/                                    # [Planned] 24 ground-truth prediction CSVs
```

**GEE_Scripts/** contains spatial mapping scripts. Each script loads satellite imagery, trains the RF model, runs a monthly prediction pipeline, and visualises results on the GEE map. Export blocks (`Export.image.toDrive()`) are present and commented out by default. Uncomment in the Code Editor when you need GeoTIFF outputs.

**Machine_Learning_Water_Quality/** contains ML-only scripts for the five optically active parameters. These load in-situ data from GEE FeatureCollection assets, train the model, and print performance metrics (MAE, RMSE, R²) as expandable Console dropdowns alongside observed-vs-predicted scatter plots. There is no export and no map layer rendering.

**Python_Colab_Scripts/** contains Python notebooks for EC, Salinity, and TDS. These use the same split logic and z-score standardization as the GEE scripts and output 1:1 scatter plots.

---

## Getting Started

### (a) Google Earth Engine Code Editor

Click the link below to add all mapping scripts directly to your Code Editor:

```
https://code.earthengine.google.com/?accept_repo=users/abshirodkar15/Water_Quality_Mapping
```

Open any script under `GEE_Scripts/` and click **Run**. The model trains, evaluates on all three data splits, and displays monthly prediction layers on the map.

The ML-only scripts in `Machine_Learning_Water_Quality/` are not hosted in the GEE Code Editor. Copy the script content from GitHub into a new GEE file to use them.

**Adapting to a new study area:**

1. Replace the `ee.FeatureCollection('projects/...')` path with your own in-situ asset.
2. Update `samplingPoints` with your station coordinates.
3. Update `selectedDateList` with your Landsat acquisition dates.
4. Adjust the `randomColumn` split thresholds if your dataset size differs significantly.

> **Note on reproducibility:** The ML-only scripts call `randomColumn()` without a seed, matching the conditions of the original model runs. Results will vary between runs. The published metrics in the thesis are from the unseeded runs whose outputs are stored in `prediction_csvs/`.

### (b) Google Colab / Python

Python notebooks for EC, Salinity, and TDS are in `Python_Colab_Scripts/`. Install dependencies before running:

```bash
pip install -r requirements.txt
```

Or install individually:

```bash
pip install earthengine-api scikit-learn matplotlib seaborn numpy pandas scipy
```

Run notebook cells in order. Metrics print at each split stage. The final cell saves 1:1 scatter plots.

---

## Script Parameters and Published Performance

All R² values are Pearson correlation-squared (aligned R²), computed separately for training, validation, and test splits.

Metrics for Turbidity, Temperature, DO, TP, and pH are from published prediction CSVs (unseeded GEE runs, thesis-verified). Metrics for EC, Salinity, and TDS are from Python notebook outputs. All values vary between runs due to unseeded randomColumn().

### Optically Active Parameters

| Parameter | Unit | RF Trees | Spectral Features | R² Train | R² Val | **R² Test** |
|-----------|------|:--------:|-------------------|:--------:|:------:|:-----------:|
| Turbidity | NTU | 100 | B3/B4, B4/B7, NDTI, NDVI | 0.783 | 0.592 | **0.814** |
| EC | µS/cm | 100 | B2/B4, B2/B3, B2+B7, B1 | 0.809 | 0.701 | **0.777** |
| Salinity | ppm | 500 | B2/B4, B2/B3, B2+B7, B6/B7 | 0.796 | 0.634 | **0.600** |
| TDS | mg/L | 100 | B2/B4, B2/B3, B2+B7, B1 | 0.780 | 0.500 | **0.750** |
| Temperature | °C | 100 | B5+B6, SWIR-1, B5+B6+B7, NIR | 0.717 | 0.173 | **0.339** |

Temperature performs poorly on the test set (R² = 0.34), which is consistent with the known limitations of passive optical sensors for surface thermal estimation and is discussed in the thesis.

### Optically Inactive Parameters

| Parameter | Unit | RF Trees | Features | R² Train | R² Val | **R² Test** |
|-----------|------|:--------:|----------|:--------:|:------:|:-----------:|
| DO | mg/L | 100 | Spectral + in-situ TDS, Turbidity* | 0.831 | 0.812 | **0.746** |
| TP | mg/L | 100 | Spectral + in-situ TDS, Turbidity* | 0.788 | 0.846 | **0.721** |
| pH | -- | 100 | Spectral + in-situ TDS, Turbidity* | 0.825 | 0.682 | **0.506** |

\* DO, TP, and pH use spectral indices alongside in-situ TDS and Turbidity as auxiliary training features. During image-level spatial prediction, training-set mean values substitute for the auxiliary features. This is the validated design described in the thesis.

Use `prediction_csvs/` for the thesis-verified values.

---

## Methodology and Key Features

Full methodology is described in the associated thesis:

> Shirodkar, A. (2025). *Near Real-Time Water Quality Monitoring with High-Resolution Satellite Images and Machine Learning Methods*. Asian Institute of Technology.

**Data:** Landsat 8/9 Collection 2 Tier 1 Surface Reflectance, scale factor 0.0000275, offset -0.2. No additional atmospheric correction beyond the C02 SR product.

**Split design:** Three-way training/validation/test split using `randomColumn()` (a GEE function that assigns a pseudo-random float per row) with parameter-specific thresholds tuned to dataset size and distribution.

**Standardization:** Z-score normalization using training-set means and standard deviations only. Validation and test sets are standardized with training statistics to prevent data leakage.

**Tree counts:** Salinity uses 500 trees following parameter-specific optimization. All other parameters use 100 trees.

**Seed policy:** Mapping scripts use `seed = 42` in `randomColumn()` for consistent spatial outputs. ML-only scripts use no seed to preserve the original run conditions.

---

## Citation

If you use this code in your research, please cite the thesis and link to this repository.

**Thesis:**

```
Shirodkar, A. (2025). Near Real-Time Water Quality Monitoring with High-Resolution
Satellite Images and Machine Learning Methods [Master's Research Project]. Asian Institute of Technology.
```

**BibTeX:**

```bibtex
@mastersthesis{shirodkar2025wqm,
  author  = {Shirodkar, Abhishek},
  title   = {Near Real-Time Water Quality Monitoring with High-Resolution
             Satellite Images and Machine Learning Methods},
  school  = {Asian Institute of Technology},
  year    = {2025},
  type    = {Master's Research Project}
}
```

**Code repository:**

```
Shirodkar, A. (2025). Water Quality Mapping: GEE and Python Framework for
Landsat-Based Water Quality Estimation [Software]. GitHub.
https://github.com/Abhiagri10/Water_Quality_Mapping
```

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## Acknowledgments

This work was conducted at Asian Institute of Technology under the supervision of [Dr. Mohana Sundaram Shanmugam](https://ait.ac.th/people/dr-mohana-sundaram-shanmugam/). Landsat imagery is provided by the United States Geological Survey (USGS) through Google Earth Engine. GEE script patterns draw on examples from the [GEE Community](https://github.com/gee-community) and [SERVIR](https://github.com/SERVIR).
