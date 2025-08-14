import rasterio
from rasterio.warp import reproject, Resampling
import numpy as np
import os

def _resample_to_match(source_path, target_profile):
    """Helper function to resample a source file to match target profile"""
    with rasterio.open(source_path) as src:
        # Create destination array
        data = np.empty((target_profile['height'], target_profile['width']), dtype=np.float32)
        
        # Reproject source to match target
        reproject(
            source=rasterio.band(src, 1),
            destination=data,
            src_transform=src.transform,
            src_crs=src.crs,
            dst_transform=target_profile['transform'],
            dst_crs=target_profile['crs'],
            resampling=Resampling.bilinear
        )
        return data

def ndvi_service(red_band_path: str, nir_band_path: str, output_folder: str = "outputs"):
    """Calculate NDVI from Red and NIR bands with resampling if needed"""
    try:
        print(f"[NDVI SERVICE] Starting with files: {red_band_path} and {nir_band_path}")
        print(f"[NDVI SERVICE] Output folder: {output_folder}")
        
        os.makedirs(output_folder, exist_ok=True)
        
        print("[NDVI SERVICE] Opening input files to check dimensions...")
        with rasterio.open(red_band_path) as red_src, rasterio.open(nir_band_path) as nir_src:
            # Determine which band to use as reference (use the higher resolution one)
            if red_src.transform.a < nir_src.transform.a:  # Red has higher resolution
                reference_src = red_src
                resample_path = nir_band_path
                print("[NDVI SERVICE] Using red band as reference for resampling")
            else:
                reference_src = nir_src
                resample_path = red_band_path
                print("[NDVI SERVICE] Using NIR band as reference for resampling")
            
            # Get the profile to match
            target_profile = reference_src.profile
            target_profile.update(dtype=rasterio.float32)
            
            print("[NDVI SERVICE] Reading and resampling if needed...")
            # Read reference band
            if reference_src == red_src:
                red_band = red_src.read(1).astype(np.float32)
                nir_band = _resample_to_match(nir_band_path, target_profile)
            else:
                nir_band = nir_src.read(1).astype(np.float32)
                red_band = _resample_to_match(red_band_path, target_profile)
            
            # Get nodata values
            red_nodata = red_src.nodata
            nir_nodata = nir_src.nodata
            
            # Create mask for invalid pixels
            mask = ((red_band == red_nodata) | 
                   (nir_band == nir_nodata) | 
                   ((nir_band + red_band) == 0))
            
            print("[NDVI SERVICE] Calculating NDVI...")
            # Calculate NDVI with proper handling of zeros
            denominator = nir_band + red_band
            denominator[denominator == 0] = np.nan  # Avoid division by zero
            
            ndvi = (nir_band - red_band) / denominator
            
            # Set invalid pixels to a specific nodata value
            ndvi_nodata = -9999
            ndvi[mask] = ndvi_nodata
            
            output_path = os.path.join(output_folder, f"ndvi_{os.path.basename(red_band_path)}")
            print(f"[NDVI SERVICE] Creating output: {output_path}")
            
            # Create output file with reference profile
            profile = target_profile.copy()
            profile.update(
                dtype=rasterio.float32,
                count=1,
                nodata=ndvi_nodata,
                driver='GTiff'
            )
            
            with rasterio.open(output_path, 'w', **profile) as dst:
                dst.write(ndvi, 1)
                dst.set_band_description(1, 'NDVI')
            
            print("[NDVI SERVICE] Completed successfully")
            return {
                "success": True,
                "output_path": output_path,
                "metadata": {
                    "index": "NDVI",
                    "formula": "(NIR - Red) / (NIR + Red)",
                    "range": "[-1, 1]",
                    "description": "Normalized Difference Vegetation Index",
                    "nodata_value": ndvi_nodata,
                    "resolution": profile['transform'].a,
                    "crs": str(profile['crs'])
                }
            }, 200
            
    except Exception as e:
        print(f"[NDVI SERVICE CRITICAL ERROR] {str(e)}")
        return {"error": f"NDVI calculation failed: {str(e)}"}, 500

def ndwi_service(green_band_path: str, nir_band_path: str, output_folder: str = "outputs"):
    """Calculate NDWI from Green and NIR bands with resampling if needed"""
    try:
        print(f"[NDWI SERVICE] Starting with files: {green_band_path} and {nir_band_path}")
        print(f"[NDWI SERVICE] Output folder: {output_folder}")
        
        os.makedirs(output_folder, exist_ok=True)
        
        print("[NDWI SERVICE] Opening input files to check dimensions...")
        with rasterio.open(green_band_path) as green_src, rasterio.open(nir_band_path) as nir_src:
            # Determine which band to use as reference
            if green_src.transform.a < nir_src.transform.a:  # Green has higher resolution
                reference_src = green_src
                resample_path = nir_band_path
                print("[NDWI SERVICE] Using green band as reference for resampling")
            else:
                reference_src = nir_src
                resample_path = green_band_path
                print("[NDWI SERVICE] Using NIR band as reference for resampling")
            
            target_profile = reference_src.profile
            target_profile.update(dtype=rasterio.float32)
            
            print("[NDWI SERVICE] Reading and resampling if needed...")
            if reference_src == green_src:
                green_band = green_src.read(1).astype(np.float32)
                nir_band = _resample_to_match(nir_band_path, target_profile)
            else:
                nir_band = nir_src.read(1).astype(np.float32)
                green_band = _resample_to_match(green_band_path, target_profile)
            
            # Get nodata values
            green_nodata = green_src.nodata
            nir_nodata = nir_src.nodata
            
            # Create mask for invalid pixels
            mask = ((green_band == green_nodata) | 
                   (nir_band == nir_nodata) | 
                   ((nir_band + green_band) == 0))
            
            print("[NDWI SERVICE] Calculating NDWI...")
            denominator = green_band + nir_band
            denominator[denominator == 0] = np.nan
            
            ndwi = (green_band - nir_band) / denominator
            
            ndwi_nodata = -9999
            ndwi[mask] = ndwi_nodata
            
            output_path = os.path.join(output_folder, f"ndwi_{os.path.basename(green_band_path)}")
            print(f"[NDWI SERVICE] Creating output: {output_path}")
            
            profile = target_profile.copy()
            profile.update(
                dtype=rasterio.float32,
                count=1,
                nodata=ndwi_nodata,
                driver='GTiff'
            )
            
            with rasterio.open(output_path, 'w', **profile) as dst:
                dst.write(ndwi, 1)
                dst.set_band_description(1, 'NDWI')
            
            print("[NDWI SERVICE] Completed successfully")
            return {
                "success": True,
                "output_path": output_path,
                "metadata": {
                    "index": "NDWI",
                    "formula": "(Green - NIR) / (Green + NIR)",
                    "range": "[-1, 1]",
                    "description": "Normalized Difference Water Index",
                    "nodata_value": ndwi_nodata,
                    "resolution": profile['transform'].a,
                    "crs": str(profile['crs'])
                }
            }, 200
            
    except Exception as e:
        print(f"[NDWI SERVICE CRITICAL ERROR] {str(e)}")
        return {"error": f"NDWI calculation failed: {str(e)}"}, 500

def ndbi_service(nir_band_path: str, swir_band_path: str, output_folder: str = "outputs"):
    """Calculate NDBI from NIR and SWIR bands with resampling if needed"""
    try:
        print(f"[NDBI SERVICE] Starting with files: {nir_band_path} and {swir_band_path}")
        print(f"[NDBI SERVICE] Output folder: {output_folder}")
        
        os.makedirs(output_folder, exist_ok=True)
        
        print("[NDBI SERVICE] Opening input files to check dimensions...")
        with rasterio.open(nir_band_path) as nir_src, rasterio.open(swir_band_path) as swir_src:
            # Determine which band to use as reference
            if nir_src.transform.a < swir_src.transform.a:  # NIR has higher resolution
                reference_src = nir_src
                resample_path = swir_band_path
                print("[NDBI SERVICE] Using NIR band as reference for resampling")
            else:
                reference_src = swir_src
                resample_path = nir_band_path
                print("[NDBI SERVICE] Using SWIR band as reference for resampling")
            
            target_profile = reference_src.profile
            target_profile.update(dtype=rasterio.float32)
            
            print("[NDBI SERVICE] Reading and resampling if needed...")
            if reference_src == nir_src:
                nir_band = nir_src.read(1).astype(np.float32)
                swir_band = _resample_to_match(swir_band_path, target_profile)
            else:
                swir_band = swir_src.read(1).astype(np.float32)
                nir_band = _resample_to_match(nir_band_path, target_profile)
            
            # Get nodata values
            nir_nodata = nir_src.nodata
            swir_nodata = swir_src.nodata
            
            # Create mask for invalid pixels
            mask = ((nir_band == nir_nodata) | 
                   (swir_band == swir_nodata) | 
                   ((swir_band + nir_band) == 0))
            
            print("[NDBI SERVICE] Calculating NDBI...")
            denominator = swir_band + nir_band
            denominator[denominator == 0] = np.nan
            
            ndbi = (swir_band - nir_band) / denominator
            
            ndbi_nodata = -9999
            ndbi[mask] = ndbi_nodata
            
            output_path = os.path.join(output_folder, f"ndbi_{os.path.basename(nir_band_path)}")
            print(f"[NDBI SERVICE] Creating output: {output_path}")
            
            profile = target_profile.copy()
            profile.update(
                dtype=rasterio.float32,
                count=1,
                nodata=ndbi_nodata,
                driver='GTiff'
            )
            
            with rasterio.open(output_path, 'w', **profile) as dst:
                dst.write(ndbi, 1)
                dst.set_band_description(1, 'NDBI')
            
            print("[NDBI SERVICE] Completed successfully")
            return {
                "success": True,
                "output_path": output_path,
                "metadata": {
                    "index": "NDBI",
                    "formula": "(SWIR - NIR) / (SWIR + NIR)",
                    "range": "[-1, 1]",
                    "description": "Normalized Difference Built-up Index",
                    "nodata_value": ndbi_nodata,
                    "resolution": profile['transform'].a,
                    "crs": str(profile['crs'])
                }
            }, 200
            
    except Exception as e:
        print(f"[NDBI SERVICE CRITICAL ERROR] {str(e)}")
        return {"error": f"NDBI calculation failed: {str(e)}"}, 500