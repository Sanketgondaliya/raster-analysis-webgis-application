import ee
import os
import logging
import requests


# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LULCDataDownloader:
    @staticmethod
    def initialize_earth_engine():
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

    @staticmethod
    def download_lulc_single(region, folder="LULC_data"):
        """Download single ESA WorldCover clipped LULC"""
        os.makedirs(folder, exist_ok=True)
        
        # Use ESA WorldCover dataset
        lulc = ee.ImageCollection("ESA/WorldCover/v200").first().clip(region)
        
        # Get the bounding box of the region
        region_bbox = region.bounds()
        region_info = region_bbox.getInfo()
        
        # Extract coordinates from the bounding box
        coords = region_info['coordinates'][0]
        min_x = min(coord[0] for coord in coords)
        max_x = max(coord[0] for coord in coords)
        min_y = min(coord[1] for coord in coords)
        max_y = max(coord[1] for coord in coords)
        
        filename = os.path.join(folder, "LULC.tif")
        
        # Get download URL with proper parameters
        url = lulc.getDownloadURL({
            "scale": 10,  # Higher resolution
            "format": "GEO_TIFF",
            "region": region_bbox,
            "crs": "EPSG:4326"
        })
        
        logger.info(f"Downloading LULC clipped to region from {url} ...")
        r = requests.get(url, stream=True)
        if r.status_code != 200:
            raise Exception(f"Failed to download LULC: {r.text}")

        with open(filename, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

        return filename







