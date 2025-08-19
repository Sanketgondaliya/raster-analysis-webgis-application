import ee
import os
import logging
import requests
import math

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LULCDataDownloader:
    def __init__(self):
        self.initialize_earth_engine()

    def initialize_earth_engine(self):
        try:
            ee.Initialize(project="ee-202319022")
            logger.info("Earth Engine initialized successfully")
        except Exception:
            logger.warning("Earth Engine not initialized. Authenticating...")
            try:
                ee.Authenticate()
                ee.Initialize(project="ee-202319022")
            except Exception as auth_error:
                logger.error(f"Failed to initialize Earth Engine: {auth_error}")
                raise

    def download_tile(self, region, scale, folder, tile_index):
        try:
            lulc = ee.ImageCollection("ESA/WorldCover/v200").first().clip(region)
            filename = f"LULC_tile_{tile_index}.tif"
            filepath = os.path.join(folder, filename)

            url = lulc.getDownloadURL({
                'scale': scale,
                'region': region.toGeoJSONString(),
                'format': 'GEO_TIFF'
            })

            logger.info(f"Downloading tile {tile_index} from {url} ...")
            r = requests.get(url, stream=True)
            if r.status_code != 200:
                raise Exception(f"Failed to download tile: {r.text}")

            with open(filepath, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)

            return filepath
        except Exception as e:
            logger.error(f"Error downloading tile {tile_index}: {e}")
            raise
    def download_lulc_single(self, region, scale=100, folder="LULC_data"):
        """Download a single clipped LULC image"""
        os.makedirs(folder, exist_ok=True)
        lulc = ee.ImageCollection("ESA/WorldCover/v200").first().clip(region)

        filename = os.path.join(folder, "LULC_single.tif")
        url = lulc.getDownloadURL({
            "scale": scale,
            "region": region.toGeoJSONString(),
            "format": "GEO_TIFF"
        })

        logger.info(f"Downloading single LULC from {url} ...")
        r = requests.get(url, stream=True)
        if r.status_code != 200:
            raise Exception(f"Failed to download LULC: {r.text}")

        with open(filename, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

        return filename

    def download_lulc_data(self, region_coords, scale=100, folder='LULC_data'):
        os.makedirs(folder, exist_ok=True)

        # Calculate number of tiles needed (2°×2° tiles)
        xmin, ymin = region_coords[0]
        xmax, ymax = region_coords[1]
        tile_size = 2.0  # degrees
        
        x_steps = math.ceil((xmax - xmin) / tile_size)
        y_steps = math.ceil((ymax - ymin) / tile_size)
        
        downloaded_files = []
        
        for i in range(x_steps):
            for j in range(y_steps):
                tile_xmin = xmin + i * tile_size
                tile_xmax = min(xmin + (i + 1) * tile_size, xmax)
                tile_ymin = ymin + j * tile_size
                tile_ymax = min(ymin + (j + 1) * tile_size, ymax)
                
                tile_region = ee.Geometry.Rectangle([
                    tile_xmin, tile_ymin, 
                    tile_xmax, tile_ymax
                ])
                
                try:
                    filepath = self.download_tile(
                        region=tile_region,
                        scale=scale,
                        folder=folder,
                        tile_index=f"{i}_{j}"
                    )
                    downloaded_files.append(filepath)
                except Exception as e:
                    logger.error(f"Skipping tile {i}_{j} due to error: {e}")
                    continue

        return {
            "downloaded_files": downloaded_files,
            "message": f"Downloaded {len(downloaded_files)} tiles"
        }


