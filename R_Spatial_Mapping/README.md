# R Spatial Mapping — Near Real-Time Canal WQ Monitoring

## Study
Cite: Shirodkar, A. B., Shanmugam, M., Shrestha, S., Tangdamrongsub, N., & 
Puno, R. (2025). Near real-time water quality monitoring of tropical canal 
networks using Landsat 8/9 surface reflectance and machine learning.
Remote Sensing of Environment. https://doi.org/[TBD]

## Workflow
GEE_Scripts/ → GeoTIFF exports → R_Spatial_Mapping/ → Publication maps

## Scripts
| Script | Scope |
|--------|-------|
| 00_shared_functions.R | Shared utility functions sourced by both Rmd notebooks |
| 01_Chao_Phraya_Canal_Maps.Rmd | Full Pathum Thani canal network (all 11 monitoring sites) |
| 02_Khlong_Nueng_Canal_Maps.Rmd | Khlong Nueng canal — narrow-geometry optimized rendering (3× lateral buffer) |

## Quick Start
1. Clone repo
2. cp config_template.R config.R → fill in your DATA_ROOT and OUTPUT_ROOT
3. Open 01_Chao_Phraya_Canal_Maps.Rmd in RStudio → Knit

## Parameters
Turbidity (NTU), TDS (mg/L), EC (µS/cm), Salinity (ppm), DO (mg/L), 
TP (mg/L), pH, Water Temperature (°C)

## Sample Data
sample_data/ contains representative GeoTIFFs for immediate testing. 
See sample_data/README.md for the file format specification.

## Requirements
R ≥ 4.2.0 | Packages install automatically via install_if_missing() 
in 00_shared_functions.R

## License
MIT
