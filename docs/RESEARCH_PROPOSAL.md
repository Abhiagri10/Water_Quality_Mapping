# Research Proposal: Transferable Landsat-Based Water Quality Estimation with Random Forest

**Status:** Draft for review
**Builds on:** Shirodkar (2025), MSc thesis, and the `Water_Quality_Mapping` repository
**Study area (current):** Chao Phraya River and Khlong Nueng canal, Pathum Thani Province, Thailand

---

## 1. Problem

The existing framework estimates eight water quality parameters (EC, salinity, TDS, turbidity, temperature, DO, TP, pH) from Landsat 8/9 surface reflectance using Random Forest regression. It was trained and tested on 11 in-situ stations sampled on 22 dates (June 2024 to January 2025).

Three problems limit what the current results support:

1. **Validation likely leaks.** Train, validation and test splits are drawn at the sample-row level (`randomColumn`), not by station. Because the same stations recur across dates, reported test skill may reflect memorising station-specific conditions rather than predicting at new locations.
2. **The metric emphasises correlation over accuracy.** R² is reported as squared Pearson correlation. This ignores bias and scale error. Temperature test R² is 0.34, and the other parameters have not been checked for bias.
3. **Transferability is asserted, not tested.** The repository states the pipeline "transfers directly" to other areas. There is one study area, one season window, and no held-out site.

## 2. Research Questions

- **RQ1.** How much of the reported skill survives when validation is grouped by station, and when it is grouped by date?
- **RQ2.** Do Landsat-derived models trained at one set of sites predict water quality at unseen sites with acceptable error (MAE, RMSE, bias)?
- **RQ3.** For parameters that are not optically active (DO, TP, pH), does the hybrid design, which uses in-situ TDS and turbidity as auxiliary inputs, add predictive value beyond spectral indices alone?
- **RQ4.** Does model skill vary between dry-season and wet-season acquisitions? The current sampling window (June 2024 to January 2025) covers the monsoon and the early dry season but not the hot dry season (February to May).

## 3. Hypotheses

- **H1.** Station-grouped test error will exceed the current random-split error for all parameters. The gap will be largest for parameters whose variation is mostly between stations (EC, salinity, TDS) rather than within them.
- **H2.** Temperature will remain the weakest parameter under every validation scheme, because passive optical sensors respond weakly to surface thermal signals.
- **H3.** Hybrid models for DO, TP and pH will outperform spectral-only models in station-grouped validation only if the auxiliary in-situ inputs are available at prediction time. If they are not, the hybrid advantage disappears and the models should be presented as a different product.

H3 is the one most likely to fail. The current design substitutes training-set means for TDS and turbidity at prediction time, which removes the information that drives the hybrid gain. The proposal treats this as a central test, not a detail.

## 4. Data

| Item | Current | Required addition |
|---|---|---|
| In-situ stations | 11 | Additional sites in at least one other basin or province |
| Acquisition dates | 22 (Jun 2024 to Jan 2025) | Dates covering February to May (hot dry season) and a second year |
| Imagery | Landsat 8/9 SR | Cloud and shadow masking report per date; Sentinel-2 as a cross-check where available |
| Water mask | Landsat NDWI | Sentinel-1 SAR backscatter as a cloud-robust alternative (for RQ4 sensitivity) |

The number of usable station-date pairs after cloud masking is not documented in the repository. This must be reported before any sample-size claim is made.

## 5. Methods

### 5.1 Validation design (RQ1)

- Compare three schemes on identical data and identical model settings:
  1. Current row-level random split (baseline).
  2. Leave-one-station-out (LOSO), using all 11 stations.
  3. Leave-one-date-out (LODO), to check temporal leakage.
- Report MAE, RMSE, bias, and R² (retained for comparability) for each scheme.
- Use paired comparisons across folds. With 11 stations, report fold-level spread, not just the mean.

### 5.2 Generalisation (RQ2)

- Train on the original study area and test on sites in a second basin or province, with no retuning.
- Pre-specify the acceptance thresholds for each parameter before running the test, for example a bias below 10% of the observed mean. These are to be set by the authors and justified against the monitoring standard used in Thailand.

### 5.3 Hybrid features (RQ3)

- Compare, under LOSO: (a) spectral-only, (b) hybrid with in-situ TDS and turbidity, (c) hybrid with mean-substitution at prediction time (the current design).
- Condition (c) is the realistic deployment case. Condition (b) is an upper bound.

### 5.4 Seasonality (RQ4)

- Stratify test errors by season and by cloud fraction.
- Report whether error increases with cloud cover after masking.

### 5.5 Reproducibility

- Fix seeds and report results across at least five seeds to show sensitivity, since the sample is small.
- Release the station-date table, cloud-mask report and split assignments as CSV, so the splits can be audited without Earth Engine access.

## 6. Expected Contributions

1. A corrected validation benchmark for Landsat-based water quality estimation in tropical canals, showing how much earlier skill reflects leakage.
2. A transferability test with pre-specified thresholds, which the current repository does not have.
3. An explicit answer on whether the hybrid DO, TP and pH design works without in-situ inputs at prediction time.

## 7. Risks and Limitations

- **Small sample.** Eleven stations give few independent spatial units. LOSO results will be noisy, and this limits the strength of any transfer claim.
- **Cloud cover.** Tropical monsoon cloud may remove many dates. The usable sample could be much smaller than 22 dates.
- **Sensor mismatch.** Landsat 8 and 9 are cross-calibrated but not identical. Pooling them needs a documented check.
- **Ground-truth quality.** The repository does not describe sampling protocols, lab methods, or detection limits for the in-situ data. These affect every result and must be documented.
- **Scope.** Canal conditions (narrow channels, mixed pixels) may violate the assumptions behind 30 m Landsat pixels. The 3× buffer used for Khlong Nueng is a rendering choice and does not address this.

## 8. Deliverables

- Revised training notebooks with grouped validation (replacing `randomColumn` splits).
- A results table reporting MAE, RMSE, bias and R² per parameter and validation scheme.
- A transferability report with pre-specified acceptance criteria and outcomes.
- Updated README stating validated parameters and unvalidated ones (DO, TP, pH until RQ3 is answered).

## 9. Open Items for the Authors

- Timeline and funding: not specified in the repository.
- Second study site: not yet identified.
- Ground-truth metadata: sampling protocol and laboratory methods to be documented.
- Pre-specified acceptance thresholds (Section 5.2): to be decided before any transfer test is run.
