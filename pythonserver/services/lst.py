import ee
import os
import logging
import requests
from datetime import datetime

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------- Core Downloader ----------
class LSTDataDownloader:
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

    def validate_dates(self, start_date, end_date):
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d')
            end = datetime.strptime(end_date, '%Y-%m-%d')
            if end <= start:
                raise ValueError("End date must be after start date")
        except ValueError as e:
            logger.error(f"Invalid date format or range: {e}")
            raise

    # def download_lst_data(self, start_date, end_date, region, scale=1000, folder='LST_data'):
    #     self.validate_dates(start_date, end_date)

    #     if not isinstance(region, ee.Geometry):
    #         raise TypeError("Region must be an ee.Geometry object")

    #     os.makedirs(folder, exist_ok=True)

    #     try:
    #         # Get MODIS LST collection
    #         modis_lst = (ee.ImageCollection('MODIS/006/MOD11A2')
    #                     .filterDate(start_date, end_date)
    #                     .filterBounds(region)
    #                     .select('LST_Day_1km'))

    #         if modis_lst.size().getInfo() == 0:
    #             raise ValueError("No MODIS LST data found for the given date range and region")

    #         # Mean and convert to Celsius
    #         mean_lst = modis_lst.mean()
    #         lst_celsius = mean_lst.multiply(0.02).subtract(273.15).clip(region)

    #         # File name and path
    #         filename = f"LST_{start_date.replace('-', '')}_to_{end_date.replace('-', '')}.tif"
    #         filepath = os.path.join(folder, filename)

    #         # Create download URL
    #         url = lst_celsius.getDownloadURL({
    #             'scale': scale,
    #             'region': region.toGeoJSONString(),
    #             'format': 'GEO_TIFF'
    #         })

    #         logger.info(f"Downloading from {url} ...")

    #         # Download file
    #         r = requests.get(url, stream=True)
    #         if r.status_code != 200:
    #             raise Exception(f"Failed to download file: {r.text}")

    #         with open(filepath, 'wb') as f:
    #             for chunk in r.iter_content(chunk_size=8192):
    #                 f.write(chunk)

    #         logger.info(f"Downloaded LST GeoTIFF to {filepath}")
    #         return {
    #             "filename": filepath,
    #             "message": "Download complete"
    #         }

    #     except Exception as e:
    #         logger.error(f"Error processing LST data: {e}")
    #         raise


    def download_lst_data(self, start_date, end_date, region, scale=1000, folder='LST_data'):
        self.validate_dates(start_date, end_date)

        if not isinstance(region, ee.Geometry):
            raise TypeError("Region must be an ee.Geometry object")

        os.makedirs(folder, exist_ok=True)

        try:
            # Get MODIS LST collection
            modis_lst = (ee.ImageCollection('MODIS/006/MOD11A2')
                        .filterDate(start_date, end_date)
                        .filterBounds(region)
                        .select('LST_Day_1km'))

            if modis_lst.size().getInfo() == 0:
                raise ValueError("No MODIS LST data found for the given date range and region")

            # Mean and convert to Celsius
            mean_lst = modis_lst.mean()
            lst_celsius = mean_lst.multiply(0.02).subtract(273.15).clip(region)

            # ---------- NEW: Calculate min & max ----------
            stats = lst_celsius.reduceRegion(
                reducer=ee.Reducer.minMax(),
                geometry=region,
                scale=scale,
                bestEffort=True,
                maxPixels=1e13
            ).getInfo()

            min_temp = stats.get("LST_Day_1km_min")
            max_temp = stats.get("LST_Day_1km_max")

            if min_temp is not None:
                min_temp = min_temp  # already in Celsius
            if max_temp is not None:
                max_temp = max_temp

            # File name and path
            filename = f"LST_{start_date.replace('-', '')}_to_{end_date.replace('-', '')}.tif"
            filepath = os.path.join(folder, filename)

            # Create download URL
            url = lst_celsius.getDownloadURL({
                'scale': scale,
                'region': region.toGeoJSONString(),
                'format': 'GEO_TIFF'
            })

            logger.info(f"Downloading from {url} ...")

            # Download file
            r = requests.get(url, stream=True)
            if r.status_code != 200:
                raise Exception(f"Failed to download file: {r.text}")

            with open(filepath, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)

            logger.info(f"Downloaded LST GeoTIFF to {filepath}")
            return {
                "filename": filepath,
                "message": "Download complete",
                "min_temp_celsius": min_temp,
                "max_temp_celsius": max_temp
            }

        except Exception as e:
            logger.error(f"Error processing LST data: {e}")
            raise

