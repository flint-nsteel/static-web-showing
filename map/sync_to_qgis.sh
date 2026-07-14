#!/usr/bin/env bash
#Pull the live photo points off the server and into a GeoPackage so
#tony's web edits flow back into QGIS project. Run from desktop.
#
#usage: ./sync_to_qgis.sh https://poggiocivitate.net
set -euo pipefail

SITE="${1:?usage: ./sync_to_qgis.sh https://poggiocivitate.net}"
STAMP=$(date +%Y%m%d)
OUT="photo_points_live_${STAMP}.gpkg"

#fetch the current live layer
curl -fsSL "${SITE}/api/photos" -o photo_points_live.geojson

#convert to a geopackage layer; open or drag this into QGIS
ogr2ogr -f GPKG "${OUT}" photo_points_live.geojson -nln photo_points_live

echo "wrote ${OUT}"
echo "in QGIS: add ${OUT} alongside project, review, then copy features into main layer"
