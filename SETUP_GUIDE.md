# GitHub Setup Guide — Windows Git Bash
# abshirodkar15/Water_Quality_WQM
# Run every command EXACTLY as written. Lines starting with # are comments — skip them.

# ============================================================
# WHAT YOU NEED BEFORE STARTING
# ============================================================
# 1. Git Bash installed (https://git-scm.com/downloads)
# 2. A GitHub account: github.com/abshirodkar15
# 3. The repository files needed:
#      README.md, .gitignore
#      gee_scripts/Optically_Active_WQPs/   (5 x .js)
#      gee_scripts/Optically_Inactive_WQPs/ (3 x .js)

# ============================================================
# STEP 1 — Create the GitHub repo (do this in your browser)
# ============================================================
# Go to: https://github.com/new
#   Repository name : Water_Quality_WQM
#   Description     : GEE mapping scripts — near real-time water quality monitoring, Pathum Thani, Thailand
#   Visibility      : Public
#   Initialize      : DO NOT check "Add a README" or ".gitignore" (we supply our own)
# Click "Create repository"
# Copy the repo URL shown: https://github.com/abshirodkar15/Water_Quality_WQM.git

# ============================================================
# STEP 2 — Build the local folder structure
# ============================================================
# Open Git Bash. Choose a working directory (e.g., your Desktop or Documents).
# Replace C:/Users/YourName/Desktop with your actual path.

cd "C:/Users/YourName/Desktop"
mkdir Water_Quality_WQM
cd Water_Quality_WQM
mkdir -p gee_scripts/Optically_Active_WQPs
mkdir -p gee_scripts/Optically_Inactive_WQPs

# ============================================================
# STEP 3 — Place the downloaded files into the folder
# ============================================================
# Manually move / copy the repository files:
#
#   Water_Quality_WQM/
#   ├── README.md
#   ├── .gitignore
#   └── gee_scripts/
#       ├── Optically_Active_WQPs/
#       │   ├── Turbidity_Mapping_v1.js
#       │   ├── EC_Mapping_v1.js
#       │   ├── Salinity_Mapping_v1.js
#       │   ├── TDS_Mapping_v1.js
#       │   └── Temperature_Mapping_v1.js
#       └── Optically_Inactive_WQPs/
#           ├── DO_Mapping_v1.js
#           ├── TP_Mapping_v1.js
#           └── pH_Mapping_v1.js
#
# Verify the structure:
ls -R

# ============================================================
# STEP 4 — Initialise Git and make the first commit
# ============================================================
git init
git config user.email "abshirodkar15@gmail.com"
git config user.name "Abhishek Shirodkar"

git add README.md .gitignore
git add gee_scripts/

git status
# Should show 10 new files (green). If you see red files, something is misplaced.

git commit -m "Initial commit: 8 GEE mapping scripts + README + .gitignore

Scripts cover 8 WQPs (Turbidity, EC, Salinity, TDS, Temperature, DO, TP, pH).
Random Forest regression trained on Landsat 8/9 + in-situ data (Pathum Thani, 2024).
Export.image.toDrive blocks commented out; Map.addLayer visualization retained."

# ============================================================
# STEP 5 — Connect to GitHub and push
# ============================================================
git remote add origin https://github.com/abshirodkar15/Water_Quality_WQM.git
git branch -M main
git push -u origin main
# Git Bash will ask for your GitHub username and password.
# For password: use a Personal Access Token (NOT your GitHub password).
# To create a token: GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic) → Generate new token
# Scopes needed: repo (full control)

# ============================================================
# STEP 6 — Tag the release for Zenodo DOI
# ============================================================
git tag -a v1.0.0 -m "v1.0.0 — thesis submission release"
git push origin v1.0.0
# Then go to: https://zenodo.org/deposit/new?upload_type=software
# Connect your GitHub account, select Water_Quality_WQM, select the v1.0.0 release.
# Zenodo will mint a DOI. Add it to README.md citation block.

# ============================================================
# STEP 7 — Verify on GitHub
# ============================================================
# Open: https://github.com/abshirodkar15/Water_Quality_WQM
# Confirm:
#   - 10 files visible
#   - README renders correctly
#   - Both gee_scripts/ subfolders show 5 and 3 scripts respectively

# ============================================================
# FUTURE UPDATES (after initial push)
# ============================================================
# To add more files later (e.g., notebooks, prediction CSVs):
#
#   git add notebooks/
#   git commit -m "Add performance-metrics notebooks (8 parameters)"
#   git push
#
# To edit a script and update GitHub:
#
#   # Edit the file locally
#   git add gee_scripts/Optically_Active_WQPs/Turbidity_Mapping_v1.js
#   git commit -m "Fix: update Turbidity split threshold to 0.65"
#   git push
