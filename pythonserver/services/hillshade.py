import os
import numpy as np
from osgeo import gdal


def hillshade_service(dem_path, z_factor=1.0, azimuth=315, altitude=45, scale=1.0):
    """Generate hillshade from an existing DEM file."""
    gdal.AllRegister()

    if not os.path.exists(dem_path):
        return {"error": f"DEM file not found: {dem_path}"}, 400

    dem_ds = gdal.Open(dem_path)
    if dem_ds is None:
        return {"error": "Could not open DEM file"}, 500

    try:
        temp_dir = "outputs"
        os.makedirs(temp_dir, exist_ok=True)
        hillshade_path = os.path.join(temp_dir, f"hillshade_{os.path.basename(dem_path)}")

        # Correct way: use DEMProcessingOptions
        dem_options = gdal.DEMProcessingOptions(
            azimuth=azimuth,
            altitude=altitude,
            zFactor=z_factor,
            scale=scale,
            computeEdges=True
        )

        gdal.DEMProcessing(
            hillshade_path,
            dem_path,
            "hillshade",
            options=dem_options
        )

        return {
            "success": True,
            "hillshade_path": hillshade_path,
            "download_url": f"/download?file={os.path.basename(hillshade_path)}"
        }, 200

    except Exception as e:
        return {"error": f"Processing failed: {str(e)}"}, 500



def compute_hillshade_stats(hillshade_path):
    """Compute min, max, mean + histogram for hillshade raster"""
    ds = gdal.Open(hillshade_path)
    band = ds.GetRasterBand(1)
    arr = band.ReadAsArray().astype(np.uint8)

    # Basic statistics
    min_val = int(np.min(arr))
    max_val = int(np.max(arr))
    mean_val = float(np.mean(arr))

    # Histogram (0–255 bins)
    hist, _ = np.histogram(arr, bins=256, range=(0, 255))
    histogram = hist.tolist()

    return {
        "min": min_val,
        "max": max_val,
        "mean": round(mean_val, 2)
    }, histogram