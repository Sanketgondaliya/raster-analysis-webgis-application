import os
import math
import numpy as np
from osgeo import gdal, osr


def elevation_profile_service(dem_path, lon1, lat1, lon2, lat2, samples=50):
    """Get elevation profile between two points, including lat/lon"""
    if not os.path.exists(dem_path):
        return {"error": f"DEM file not found: {dem_path}"}, 400

    try:
        ds = gdal.Open(dem_path)
        if ds is None:
            return {"error": "Failed to open DEM file"}, 500

        gt = ds.GetGeoTransform()
        proj = osr.SpatialReference(wkt=ds.GetProjection())

        wgs84 = osr.SpatialReference()
        wgs84.ImportFromEPSG(4326)

        # Transform from WGS84 to DEM projection
        transform_to_proj = osr.CoordinateTransformation(wgs84, proj)
        # Transform from DEM projection back to WGS84
        transform_to_wgs84 = osr.CoordinateTransformation(proj, wgs84)

        x1, y1, _ = transform_to_proj.TransformPoint(lon1, lat1)
        x2, y2, _ = transform_to_proj.TransformPoint(lon2, lat2)

        total_distance = math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
        distances = []
        elevations = []
        lats = []
        lons = []

        band = ds.GetRasterBand(1)

        for i in range(samples + 1):
            t = i / samples
            x = x1 + t * (x2 - x1)
            y = y1 + t * (y2 - y1)

            px = int((x - gt[0]) / gt[1])
            py = int((y - gt[3]) / gt[5])

            if px < 0 or py < 0 or px >= ds.RasterXSize or py >= ds.RasterYSize:
                continue

            arr = band.ReadAsArray(px, py, 1, 1)
            if arr is None:
                continue

            elevation = arr[0][0]
            lon_lat = transform_to_wgs84.TransformPoint(x, y)  # (lon, lat, z)
            lon_pt, lat_pt = lon_lat[0], lon_lat[1]

            distances.append(total_distance * t)
            elevations.append(float(elevation))
            lons.append(lon_pt)
            lats.append(lat_pt)

        ds = None

        profile = [
            {"distance": d, "elevation": e, "longitude": lo, "latitude": la}
            for d, e, lo, la in zip(distances, elevations, lons, lats)
        ]

        return {
            "success": True,
            "profile": profile
        }, 200

    except Exception as e:
        return {"error": str(e)}, 500
