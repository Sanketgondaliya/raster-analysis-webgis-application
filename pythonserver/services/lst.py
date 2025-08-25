import ee
import os
import logging
import requests
from datetime import datetime

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------- Earth Engine Downloader ----------------
class LSTDataDownloader:
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
    def validate_dates(start_date, end_date):
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d')
            end = datetime.strptime(end_date, '%Y-%m-%d')
            if end <= start:
                raise ValueError("End date must be after start date")
        except ValueError as e:
            logger.error(f"Invalid date format or range: {e}")
            raise

    @staticmethod
    def download_lst_single(start_date, end_date, region, scale=1000, folder="LST_data"):
        """Download MODIS LST mean clipped to region"""
        os.makedirs(folder, exist_ok=True)

        LSTDataDownloader.validate_dates(start_date, end_date)

        # Get MODIS LST dataset
        modis_lst = (
            ee.ImageCollection("MODIS/006/MOD11A2")
            .filterDate(start_date, end_date)
            .filterBounds(region)
            .select("LST_Day_1km")
        )

        if modis_lst.size().getInfo() == 0:
            raise ValueError("No MODIS LST data found for given range/region")

        # Mean LST in Celsius
        mean_lst = modis_lst.mean()
        lst_celsius = mean_lst.multiply(0.02).subtract(273.15).clip(region)

        filename = os.path.join(folder, "LST.tif")

        # Get download URL
        url = lst_celsius.getDownloadURL({
            "scale": scale,
            "region": region,
            "format": "GEO_TIFF",
            "crs": "EPSG:4326"
        })

        logger.info(f"Downloading LST from {url} ...")
        r = requests.get(url, stream=True)
        if r.status_code != 200:
            raise Exception(f"Failed to download LST: {r.text}")

        with open(filename, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

        return filename


