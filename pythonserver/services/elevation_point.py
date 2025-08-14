import os
import math
import numpy as np
from osgeo import gdal, osr

def elevation_point_service(dem_path, lon, lat):
    """Get elevation at a given point (lon, lat) from DEM"""
    if not os.path.exists(dem_path):
        return {"error": f"DEM file not found: {dem_path}"}, 400

    try:
        ds = gdal.Open(dem_path)
        if ds is None:
            return {"error": "Failed to open DEM file"}, 500

        # Get spatial reference and transformation
        gt = ds.GetGeoTransform()
        proj = osr.SpatialReference(wkt=ds.GetProjection())

        wgs84 = osr.SpatialReference()
        wgs84.ImportFromEPSG(4326)
        transform = osr.CoordinateTransformation(wgs84, proj)

        x, y, _ = transform.TransformPoint(lon, lat)

        # Pixel coordinates
        px = int((x - gt[0]) / gt[1])
        py = int((y - gt[3]) / gt[5])

        # Read elevation
        band = ds.GetRasterBand(1)
        if px < 0 or py < 0 or px >= ds.RasterXSize or py >= ds.RasterYSize:
            return {"error": "Point is outside DEM extent"}, 400

        elevation = band.ReadAsArray(px, py, 1, 1)[0][0]

        ds = None
        return {
            "success": True,
            "lon": lon,
            "lat": lat,
            "elevation": float(elevation)
        }, 200

    except Exception as e:
        return {"error": str(e)}, 500