from osgeo import gdal
import os

def slope_service(dem_path, slope_format="degree", scale=1.0, compute_edges=True):
    """Generate slope map from DEM file"""
    gdal.AllRegister()

    if not os.path.exists(dem_path):
        return {"error": f"DEM file not found: {dem_path}"}, 400

    try:
        temp_dir = "outputs"
        os.makedirs(temp_dir, exist_ok=True)
        slope_path = os.path.join(temp_dir, f"slope_{os.path.basename(dem_path)}")

        options = gdal.DEMProcessingOptions(
            computeEdges=compute_edges,
            slopeFormat=slope_format,
            scale=scale
        )

        gdal.DEMProcessing(
            slope_path,
            dem_path,
            "slope",
            options=options
        )

        return {
            "success": True,
            "slope_path": slope_path,
            "parameters": {
                "slope_format": slope_format,
                "scale": scale,
                "compute_edges": compute_edges
            }
        }, 200

    except Exception as e:
        return {"error": f"Slope calculation failed: {str(e)}"}, 500
