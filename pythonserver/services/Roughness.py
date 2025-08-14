from osgeo import gdal
import os

def roughness_service(dem_path, z_factor=1.0, scale=1.0):
    """Calculate surface roughness from DEM."""
    gdal.AllRegister()

    if not os.path.exists(dem_path):
        return {"error": f"DEM file not found: {dem_path}"}, 400

    dem_ds = gdal.Open(dem_path)
    if dem_ds is None:
        return {"error": "Could not open DEM file"}, 500

    try:
        temp_dir = "outputs"
        os.makedirs(temp_dir, exist_ok=True)
        output_path = os.path.join(temp_dir, f"roughness_{os.path.basename(dem_path)}")

        dem_options = gdal.DEMProcessingOptions(
            zFactor=z_factor,
            scale=scale,
            computeEdges=True
        )

        gdal.DEMProcessing(
            output_path,
            dem_path,
            "roughness",
            options=dem_options
        )

        return {
            "success": True,
            "output_path": output_path,
            "download_url": f"/download?file={os.path.basename(output_path)}",
            "metadata": {
                "analysis_type": "roughness",
                "description": "Surface texture variability calculated",
                "z_factor": z_factor,
                "scale": scale
            }
        }, 200

    except Exception as e:
        return {"error": f"Roughness calculation failed: {str(e)}"}, 500