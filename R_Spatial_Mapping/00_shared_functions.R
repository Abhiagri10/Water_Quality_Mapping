# =============================================================================
# 00_shared_functions.R — Shared Utility Functions for the NRT Canal WQ
#                          Spatial Mapping Pipeline
# =============================================================================
#
# STUDY
#   Shirodkar, A. B., Shanmugam, M., Shrestha, S., Tangdamrongsub, N., &
#   Puno, R. (2025). Near real-time water quality monitoring of tropical canal
#   networks using Landsat 8/9 surface reflectance and machine learning.
#   Remote Sensing of Environment. https://doi.org/[assigned upon acceptance]
#
# PURPOSE
#   Defines all utility functions sourced by both Rmd notebooks:
#     01_All_Network_Maps.Rmd      — full 11-site canal network
#     02_Khlong_Nueng_Maps.Rmd     — Khlong Nueng canal (narrow geometry)
#
# FUNCTIONS DEFINED HERE
#   install_if_missing()           — package dependency manager
#   analyze_raster_shape()         — raster geometry + optimal buffer calc
#   extract_raster_info()          — filename metadata parser (two variants)
#   fetch_basemap_tiles()          — tile download with provider fallback
#   build_parameter_settings()     — WQ parameter configuration table
#   list_available_files()         — directory scanner per parameter
#   save_wq_map()                  — ggsave wrapper with auto-directory creation
#
# REPOSITORY
#   https://github.com/Abhiagri10/Water_Quality_Mapping
#
# CONTACT
#   Abhishek Babuso Shirodkar <st124278@ait.asia>
# =============================================================================


# ── Package installation ──────────────────────────────────────────────────────

#' Install a vector of CRAN packages if they are not already present.
#'
#' @param pkgs Character vector of package names.
#' @param quiet Logical. Suppress install messages. Default TRUE.
#' @return NULL, invisibly.
install_if_missing <- function(pkgs, quiet = TRUE) {
  missing <- pkgs[!vapply(pkgs, requireNamespace, logical(1), quietly = TRUE)]
  if (length(missing) > 0L) {
    message("Installing missing packages: ", paste(missing, collapse = ", "))
    install.packages(missing, quiet = quiet)
  }
  invisible(NULL)
}

# Required packages for both notebooks
REQUIRED_PACKAGES <- c(
  "terra",          # Modern raster/vector handling
  "sf",             # Simple Features vector data
  "tidyverse",      # Data manipulation and pipe operator
  "ggplot2",        # Plotting engine
  "ggspatial",      # Map cartographic elements (scale bar, north arrow)
  "viridis",        # Perceptually-uniform colour palettes
  "scales",         # Axis / legend formatting helpers
  "patchwork",      # Multi-panel plot composition
  "RColorBrewer",   # Sequential and diverging colour palettes
  "stars",          # Spatiotemporal raster arrays
  "maptiles",       # Slippy-map basemap tile download
  "tidyterra",      # ggplot2 geoms for terra SpatRaster objects
  "gridExtra",      # Legacy multi-plot arrangement
  "ggtext"          # Markdown rendering inside ggplot2 text elements
)

install_if_missing(REQUIRED_PACKAGES)

suppressPackageStartupMessages({
  library(terra)
  library(sf)
  library(tidyverse)
  library(ggplot2)
  library(ggspatial)
  library(viridis)
  library(scales)
  library(patchwork)
  library(RColorBrewer)
  library(stars)
  library(maptiles)
  library(tidyterra)
  library(gridExtra)
  library(ggtext)
})


# ── Raster geometry ──────────────────────────────────────────────────────────

#' Analyse raster spatial extent and derive optimal display parameters.
#'
#' Computes width, height, aspect ratio, and a buffer percentage used to add
#' context around the raster when fetching basemap tiles.
#'
#' @param r A \code{terra::SpatRaster} object.
#' @return A named list with elements:
#'   \describe{
#'     \item{width}{E-W extent in CRS units.}
#'     \item{height}{N-S extent in CRS units.}
#'     \item{aspect_ratio}{width / height.}
#'     \item{is_vertical}{Logical; TRUE when aspect_ratio < 0.8.}
#'     \item{is_horizontal}{Logical; TRUE when aspect_ratio > 1.2.}
#'     \item{buffer_percent}{Base buffer as a fraction of the relevant dimension.}
#'   }
analyze_raster_shape <- function(r) {
  default <- list(
    width = NA_real_, height = NA_real_, aspect_ratio = NA_real_,
    is_vertical = FALSE, is_horizontal = FALSE, buffer_percent = 0.1
  )

  if (is.null(r) || !inherits(r, "SpatRaster") || terra::ncell(r) == 0L) {
    warning("analyze_raster_shape: invalid or empty SpatRaster supplied.")
    return(default)
  }

  ext_vec <- tryCatch(as.vector(terra::ext(r)), error = function(e) NULL)

  if (is.null(ext_vec) || length(ext_vec) != 4L ||
      !all(is.finite(ext_vec))) {
    warning("analyze_raster_shape: could not extract a finite extent.")
    return(default)
  }

  w <- ext_vec[2L] - ext_vec[1L]   # xmax - xmin
  h <- ext_vec[4L] - ext_vec[3L]   # ymax - ymin

  if (!all(is.finite(c(w, h))) || w <= 0 || h <= 0) {
    warning("analyze_raster_shape: zero or negative raster dimension detected.")
    return(modifyList(default, list(width = w, height = h)))
  }

  ar  <- w / h
  vert <- ar < 0.8
  horiz <- ar > 1.2

  list(
    width        = w,
    height       = h,
    aspect_ratio = ar,
    is_vertical  = vert,
    is_horizontal = horiz,
    buffer_percent = if (vert) 0.20 else if (horiz) 0.05 else 0.10
  )
}


# ── Filename metadata parsers ─────────────────────────────────────────────────

#' Parse metadata from an all-network GeoTIFF filename.
#'
#' Expected naming convention (from GEE export):
#'   {WaterBody}_{Parameter}_MonthlyAvg_{YYYY-MM}.tif
#' Example:  Chao_Phraya_Turbidity_MonthlyAvg_2019-11.tif
#'
#' @param file_path Full or relative path to the GeoTIFF file.
#' @return A named list with elements \code{file_path}, \code{water_body},
#'   \code{parameter}, \code{year}, \code{month_abbr}, \code{month_name},
#'   \code{date_string}, and \code{clean_name}; or \code{NULL} on parse failure.
parse_allnetwork_filename <- function(file_path) {
  fname  <- basename(file_path)
  parts  <- strsplit(fname, "_")[[1L]]
  ma_idx <- which(parts == "MonthlyAvg")

  if (length(parts) < 4L || length(ma_idx) != 1L || ma_idx < 3L) {
    warning("parse_allnetwork_filename: '", fname,
            "' does not match '{WaterBody}_{Param}_MonthlyAvg_{YYYY-MM}.tif'")
    return(NULL)
  }

  param    <- parts[ma_idx - 1L]
  wb_parts <- parts[seq_len(ma_idx - 2L)]
  wb       <- paste(wb_parts, collapse = "_")

  date_raw <- gsub("\\.tif$", "", parts[length(parts)])
  if (!grepl("^\\d{4}-\\d{2}$", date_raw)) {
    warning("parse_allnetwork_filename: invalid date '", date_raw,
            "' in '", fname, "' (expected YYYY-MM).")
    return(NULL)
  }

  yr  <- substr(date_raw, 1L, 4L)
  mth <- substr(date_raw, 6L, 7L)
  mname <- tryCatch(
    format(as.Date(paste0(yr, "-", mth, "-01")), "%b"),
    error = function(e) mth
  )

  list(
    file_path   = file_path,
    water_body  = wb,
    parameter   = param,
    year        = yr,
    month_abbr  = mth,
    month_name  = mname,
    date_string = paste(mname, yr),
    clean_name  = paste(wb, mname, yr)
  )
}


#' Parse metadata from a Khlong Nueng GeoTIFF filename.
#'
#' Expected naming convention (from GEE export):
#'   Khlong_Nueng_{Parameter}_{YYYY-MM}.tif
#' Example:  Khlong_Nueng_Turbidity_2019-11.tif
#'
#' @param file_path Full or relative path to the GeoTIFF file.
#' @return A named list (same structure as \code{parse_allnetwork_filename});
#'   or \code{NULL} on parse failure.
parse_khlong_filename <- function(file_path) {
  fname  <- basename(file_path)
  parts  <- strsplit(fname, "_")[[1L]]

  # Require at least "Khlong", "Nueng", <Parameter>, <Date>
  if (length(parts) < 4L || parts[1L] != "Khlong" || parts[2L] != "Nueng") {
    warning("parse_khlong_filename: '", fname,
            "' does not match 'Khlong_Nueng_{Param}_{YYYY-MM}.tif'")
    return(NULL)
  }

  param    <- parts[3L]
  date_raw <- gsub("\\.tif$", "", parts[length(parts)])

  if (!grepl("^\\d{4}-\\d{2}$", date_raw)) {
    warning("parse_khlong_filename: invalid date '", date_raw,
            "' in '", fname, "' (expected YYYY-MM).")
    return(NULL)
  }

  yr    <- substr(date_raw, 1L, 4L)
  mth   <- substr(date_raw, 6L, 7L)
  mname <- tryCatch(
    format(as.Date(paste0(yr, "-", mth, "-01")), "%b"),
    error = function(e) mth
  )

  list(
    file_path   = file_path,
    water_body  = "Khlong_Nueng",
    parameter   = param,
    year        = yr,
    month_abbr  = mth,
    month_name  = mname,
    date_string = paste(mname, yr),
    clean_name  = paste("Khlong_Nueng", mname, yr)
  )
}


# ── Basemap tile fetching ─────────────────────────────────────────────────────

#' Download basemap tiles with automatic provider fallback.
#'
#' Tries providers in \code{providers} order, returning the first successful
#' result. If all providers fail, returns \code{NULL} (ggplot will render a
#' plain grey background instead).
#'
#' @param bbox_sf An \code{sf} geometry used as the tile extent.
#' @param providers Character vector of maptiles provider strings, in
#'   preference order. Defaults to \code{BASEMAP_PROVIDERS} from config.R.
#' @return A \code{terra::SpatRaster} tile object, or \code{NULL}.
fetch_basemap_tiles <- function(bbox_sf, providers = BASEMAP_PROVIDERS) {
  if (is.null(bbox_sf)) return(NULL)

  for (p in providers) {
    tiles <- tryCatch(
      maptiles::get_tiles(bbox_sf, provider = p, crop = TRUE),
      error = function(e) NULL
    )
    if (!is.null(tiles)) return(tiles)
  }

  message("fetch_basemap_tiles: all providers failed — map will use plain background.")
  NULL
}


# ── Parameter settings ───────────────────────────────────────────────────────

#' Build the standard parameter settings list.
#'
#' Constructs per-parameter visualisation settings (units, colour range, colour
#' palette, reversed-palette flag) and constructs data/output directory paths
#' by combining DATA_ROOT and OUTPUT_ROOT from config.R with PARAM_SUBDIRS.
#'
#' @return A named list; one entry per WQ parameter.
#' @note Called automatically by both notebooks after config.R is sourced.
build_parameter_settings <- function() {
  list(
    "TDS" = list(
      unit          = "mg/L",
      min_val       = 150,
      max_val       = 400,
      color_palette = c("blue","cyan","green","yellow","orange","red","magenta"),
      reverse_colors = FALSE,
      geotiff_dir   = file.path(DATA_ROOT, PARAM_SUBDIRS$TDS),
      output_dir    = file.path(OUTPUT_ROOT, "Monthly_Maps_TDS")
    ),
    "EC" = list(
      unit          = "\u00b5S/cm",
      min_val       = 250,
      max_val       = 600,
      color_palette = c("blue","cyan","green","yellow","orange","red","magenta"),
      reverse_colors = FALSE,
      geotiff_dir   = file.path(DATA_ROOT, PARAM_SUBDIRS$EC),
      output_dir    = file.path(OUTPUT_ROOT, "Monthly_Maps_EC")
    ),
    "Salinity" = list(
      unit          = "ppm",
      min_val       = 100,
      max_val       = 400,
      color_palette = c("blue","cyan","green","yellow","orange","red","magenta"),
      reverse_colors = FALSE,
      geotiff_dir   = file.path(DATA_ROOT, PARAM_SUBDIRS$Salinity),
      output_dir    = file.path(OUTPUT_ROOT, "Monthly_Maps_Salinity")
    ),
    "DO" = list(
      unit          = "mg/L",
      min_val       = 4,
      max_val       = 10,
      color_palette = c("blue","cyan","green","yellow","orange","red","magenta"),
      reverse_colors = TRUE,           # Low DO = red (stressed conditions)
      geotiff_dir   = file.path(DATA_ROOT, PARAM_SUBDIRS$DO),
      output_dir    = file.path(OUTPUT_ROOT, "Monthly_Maps_DO")
    ),
    "TP" = list(
      unit          = "mg/L",
      min_val       = 0,
      max_val       = 1.5,
      color_palette = c("blue","cyan","green","yellow","orange","red","magenta"),
      reverse_colors = FALSE,
      geotiff_dir   = file.path(DATA_ROOT, PARAM_SUBDIRS$TP),
      output_dir    = file.path(OUTPUT_ROOT, "Monthly_Maps_TP")
    ),
    "pH" = list(
      unit          = "",              # pH is dimensionless
      min_val       = 6.5,
      max_val       = 8.5,
      color_palette = c("blue","cyan","green","yellow","orange","red","magenta"),
      reverse_colors = FALSE,
      geotiff_dir   = file.path(DATA_ROOT, PARAM_SUBDIRS$pH),
      output_dir    = file.path(OUTPUT_ROOT, "Monthly_Maps_pH")
    ),
    "Tempt" = list(
      unit          = "\u00b0C",
      min_val       = 27,
      max_val       = 35,
      color_palette = c("blue","cyan","green","yellow","orange","red","magenta"),
      reverse_colors = FALSE,
      geotiff_dir   = file.path(DATA_ROOT, PARAM_SUBDIRS$Tempt),
      output_dir    = file.path(OUTPUT_ROOT, "Monthly_Maps_Tempt")
    ),
    "Turbidity" = list(
      unit          = "NTU",
      min_val       = 0,
      max_val       = 50,
      color_palette = c("blue","cyan","green","yellow","orange","red","magenta"),
      reverse_colors = FALSE,
      geotiff_dir   = file.path(DATA_ROOT, PARAM_SUBDIRS$Turbidity),
      output_dir    = file.path(OUTPUT_ROOT, "Monthly_Maps_Turbidity")
    )
  )
}


# ── File listing ─────────────────────────────────────────────────────────────

#' List GeoTIFF files available for a given WQ parameter.
#'
#' Scans \code{settings$geotiff_dir} for *.tif files whose names contain the
#' parameter string (case-insensitive). An optional \code{water_body} filter
#' further restricts results (useful for Khlong Nueng-only queries).
#'
#' @param parameter_name Character. One of the names in the parameter settings
#'   list (e.g. "Turbidity", "DO").
#' @param settings List. The parameter settings entry for \code{parameter_name}.
#' @param water_body Character or NULL. If non-NULL, keep only files whose
#'   basename contains this string.
#' @param verbose Logical. Print the found files to the console. Default TRUE.
#' @return Character vector of matching file paths (invisibly).
list_available_files <- function(parameter_name, settings, water_body = NULL,
                                  verbose = TRUE) {
  dir_path <- settings$geotiff_dir

  if (!dir.exists(dir_path)) {
    message("list_available_files: directory not found — ", dir_path)
    return(invisible(character(0L)))
  }

  all_tifs <- list.files(dir_path, pattern = "\\.tif$", full.names = TRUE)
  matched  <- all_tifs[grepl(parameter_name, basename(all_tifs),
                              ignore.case = TRUE)]

  if (!is.null(water_body)) {
    matched <- matched[grepl(water_body, basename(matched), ignore.case = TRUE)]
  }

  if (verbose) {
    scope_label <- if (is.null(water_body)) "all zones" else water_body
    cat(sprintf("Found %d GeoTIFF file(s) for %s [%s]:\n",
                length(matched), parameter_name, scope_label))
    if (length(matched) > 0L) {
      for (i in seq_along(matched))
        cat(sprintf("  [%2d]  %s\n", i, basename(matched[i])))
    }
  }

  invisible(matched)
}


# ── Map export ───────────────────────────────────────────────────────────────

#' Save a ggplot WQ map to disk.
#'
#' Creates the output directory if it does not already exist, then writes the
#' map using \code{ggplot2::ggsave()} with settings from config.R.
#'
#' @param map      A ggplot object (the rendered map).
#' @param output_dir Character. Directory where the file will be saved.
#' @param water_body Character. Used in the output filename.
#' @param parameter Character. WQ parameter name; used in the filename.
#' @param month_abbr Character. Two-digit month code (e.g. "11").
#' @param year     Character. Four-digit year string (e.g. "2019").
#' @return The full output file path, invisibly.
save_wq_map <- function(map, output_dir, water_body, parameter,
                         month_abbr, year) {
  if (is.null(map)) {
    message("save_wq_map: map is NULL — nothing saved.")
    return(invisible(NULL))
  }

  if (!dir.exists(output_dir)) dir.create(output_dir, recursive = TRUE)

  fname <- sprintf("%s_%s_%s-%s.%s",
                   water_body, parameter, year, month_abbr,
                   MAP_FORMAT)
  fpath <- file.path(output_dir, fname)

  ggplot2::ggsave(
    filename = fpath,
    plot     = map,
    width    = MAP_WIDTH,
    height   = MAP_HEIGHT,
    dpi      = MAP_DPI,
    units    = "in"
  )

  message("Saved: ", fpath)
  invisible(fpath)
}

# =============================================================================
# END OF 00_shared_functions.R
# =============================================================================
