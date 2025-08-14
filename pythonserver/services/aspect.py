from osgeo import gdal
import os

def aspect_service(dem_path, trigonometric=True, zero_for_flat=True):
    gdal.AllRegister()

    if not os.path.exists(dem_path):
        return {"error": f"DEM file not found: {dem_path}"}, 400

    try:
        temp_dir = "outputs"
        os.makedirs(temp_dir, exist_ok=True)
        aspect_path = os.path.join(temp_dir, f"aspect_{os.path.basename(dem_path)}")

        options = gdal.DEMProcessingOptions(
            computeEdges=True,
            trigonometric=trigonometric,
            zeroForFlat=zero_for_flat
        )

        gdal.DEMProcessing(
            aspect_path,
            dem_path,  # here we can pass path directly
            "aspect",
            options=options
        )

        return {
            "success": True,
            "aspect_path": aspect_path,
            "parameters": {
                "trigonometric": trigonometric,
                "zero_for_flat": zero_for_flat
            },
            "download_url": f"/download?file={os.path.basename(aspect_path)}"
        }, 200

    except Exception as e:
        return {"error": f"Aspect calculation failed: {str(e)}"}, 500
