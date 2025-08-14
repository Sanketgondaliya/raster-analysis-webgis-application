from osgeo import gdal
import os

def curvature_service(dem_path, z_factor=1.0, scale=1.0):
    """Calculate profile curvature from DEM."""
    try:
        # Register GDAL drivers
        gdal.AllRegister()
        
        # Verify input file exists and is readable
        if not os.path.exists(dem_path):
            return {"error": f"DEM file not found: {dem_path}"}, 400
        
        # Try opening the input file to verify it's a valid raster
        try:
            ds = gdal.Open(dem_path)
            if ds is None:
                return {"error": "Could not open DEM file - may be corrupt or invalid format"}, 400
            ds = None  # Close the dataset
        except Exception as e:
            return {"error": f"Invalid DEM file: {str(e)}"}, 400

        # Prepare output directory
        temp_dir = "outputs"
        os.makedirs(temp_dir, exist_ok=True)
        
        # Create unique output filename
        base_name = os.path.splitext(os.path.basename(dem_path))[0]
        output_path = os.path.join(temp_dir, f"curvature_{base_name}.tif")

        # Set processing options
        dem_options = gdal.DEMProcessingOptions(
            zFactor=z_factor,
            scale=scale,
            computeEdges=True,
            format='GTiff',
            creationOptions=['COMPRESS=LZW']
        )

        # Perform the curvature calculation
        try:
            gdal.DEMProcessing(
                output_path,
                dem_path,
                "profilecurvature",
                options=dem_options
            )
        except Exception as e:
            return {"error": f"GDAL processing failed: {str(e)}"}, 500

        # Verify output was created
        if not os.path.exists(output_path):
            return {"error": "GDAL failed to create output file"}, 500
        
        # Verify output is readable
        try:
            ds = gdal.Open(output_path)
            if ds is None:
                return {"error": "Output file created but is invalid"}, 500
            ds = None
        except Exception as e:
            return {"error": f"Output verification failed: {str(e)}"}, 500

        return {
            "success": True,
            "output_path": output_path
        }, 200

    except Exception as e:
        return {"error": f"Curvature calculation failed: {str(e)}"}, 500