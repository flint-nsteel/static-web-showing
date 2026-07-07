# Coordinate Transformations: Derivation and Verification

This document records how the affine transformation parameters used by the
Coordinate Converter (converter.html / conversionsonefunction.js) were derived,
and how the full conversion chain has been verified against the original GPS
measurements. It is based on the project's derivation notes
(pc_transformation.rtf, vesco_transformation.rtf).

This is based entirely on Dr. Taylor Oshen's work, none of this would be possible without him.

## Overview

Each excavation area uses a local site grid measured in meters. The converter
relates three coordinate systems:

- **Site grid** (local x, y): Poggio Civitate master grid, or the Vescovado di
  Murlo grid (origin near the center of the canopy over the conserved Roman
  remains; the grid is rotated roughly 29 degrees relative to north, this is also called the Tennis Courts)
- **EPSG:3003** (Monte Mario / Italy zone 1):
  the projected system the affine transforms map into, chosen because of avaliablity of topographic information.
- **WGS84** (longitude, latitude): standard GPS coordinates, used heavily on the web. Drifts over time.

The chain is: site grid <-> EPSG:3003 via an affine transform, and
EPSG:3003 <-> WGS84 via a standard map projection with datum shift (handled in
the browser by proj4js).

## How the affine parameters were derived

For each site, three points with known local grid coordinates were measured by
GPS in WGS84. The GPS points were projected into EPSG:3003 using QGIS. The six
affine parameters were then solved exactly from the three point pairs using
numpy (an affine transform in 2D has six unknowns, and three points give six
equations):

```python
import numpy as np

#columns are the control points; bottom row of ones enables the translation terms
local = np.array([[x1, x2, x3],
                  [y1, y2, y3],
                  [1,  1,  1]])
proj = np.array([[X1, X2, X3],
                 [Y1, Y2, Y3]])

def affine_params(a, b):
    return np.array(np.matrix(b) * np.linalg.inv(np.matrix(a)))
```

Because the fit is exact (no redundancy), any GPS measurement error is absorbed
into the parameters. This is why the transforms include tiny residual scale
factors (determinant 1.0005 for PC, 0.9980 for VESCO) rather than being pure
rotation plus translation.

## Control points

### Poggio Civitate (master grid)

| Local (x, y) | EPSG:3003 (X, Y) | WGS84 (lon, lat) |
|---|---|---|
| (176, 0) | (1695311.06020758, 4780643.70514199) | (11.40176641, 43.15321244) |
| (0, 0)   | (1695135.19718962, 4780651.43589245) | (11.39960809, 43.15332736) |
| (0, 39)  | (1695136.94145948, 4780690.40788664) | (11.39964325, 43.15367753) |

Resulting forward transform (site -> EPSG:3003):

```
X = x *  0.999221692962 + y * 0.0447248683267 + 1695135.19719
Y = x * -0.0439247185204 + y * 0.999281902346 + 4780651.43589
```

### Vescovado di Murlo

| Local (x, y) | EPSG:3003 (X, Y) | WGS84 (lon, lat) |
|---|---|---|
| (-18, 2)   | (1694381.37477224, 4782629.09127717) | (11.39103894, 43.17131393) |
| (-18, -17) | (1694372.14021553, 4782612.49143979) | (11.3909196, 43.17116696) |
| (-1, -17)  | (1694386.95078427, 4782604.20737838) | (11.39109874, 43.17108862) |

Resulting forward transform (site -> EPSG:3003):

```
X = x *  0.87120992587  + y * 0.486029300286 + 1694396.08449
Y = x * -0.487297729938 + y * 0.873675651295 + 4782618.57257
```

## The inverse transforms

The converter also supports EPSG:3003 -> site and WGS84 -> site. The affine is
inverted analytically. With forward parameters a, b, c, d, tx, ty:

```
det = a*d - b*c
x = ( d*(X - tx) - b*(Y - ty)) / det
y = (-c*(X - tx) + a*(Y - ty)) / det
```

Round-trips through the inverse reproduce the input to nine decimal places.

## EPSG:3003 <-> WGS84 in the browser

The website performs the projection step with proj4js using this definition,
which includes the seven-parameter datum shift from the Rome 1940 (Monte Mario)
datum to WGS84:

```
+proj=tmerc +lat_0=0 +lon_0=9 +k=0.9996 +x_0=1500000 +y_0=0 +ellps=intl
+towgs84=-104.1,-49.1,-9.9,0.971,-2.917,0.714,-11.68 +units=m +no_defs
```

## Verification against ground truth

The complete chain (site grid -> affine -> EPSG:3003 -> proj4 -> WGS84) was run
on all six control points and compared to the original GPS measurements:

- Affine residuals at every control point: below 0.01 mm
- WGS84 output vs original GPS coordinates: within 0 to 1 mm at all six points

The second result also confirms that the towgs84 datum-shift parameters used in
the browser match the projection QGIS applied during the original derivation,
so the website conversion is faithful to the source methodology end to end.

## Practical accuracy notes

- The transforms are exact at the control points by construction. Away from
  them, accuracy is limited by the original GPS measurements and by how well a
  single affine models each grid; I think around centimeter-level agreement within the
  surveyed areas.
- Coordinates displayed to 3 decimals (millimeters) for projected values and 7
  decimals (about 1 cm) for degrees exceed the "real" accuracy of the
  transforms; the extra digits are for round-trip stability, not precision.
- Converting a point measured on one site grid into the other site's grid is
  mathematically valid (both go through EPSG:3003) but crosses between two
  independently derived transforms, so treat cross-grid results with the
  combined uncertainty of both.
