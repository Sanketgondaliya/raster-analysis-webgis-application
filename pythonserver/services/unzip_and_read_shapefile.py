import os
import tempfile
import zipfile
import geopandas as gpd
from sentinelhub import  CRS, Geometry
import ee
from osgeo import gdal
import logging

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Helper function for unzip + shapefile reading ---
def unzip_and_read_shapefile(zip_path: str):
    """Unzips a shapefile ZIP and returns a SentinelHub Geometry + bounds"""
    if not os.path.exists(zip_path):
        raise FileNotFoundError(f"File not found: {zip_path}")

    with tempfile.TemporaryDirectory() as tmpdir:
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(tmpdir)

        # Find .shp file inside extracted folder
        shp_files = [f for f in os.listdir(tmpdir) if f.endswith(".shp")]
        if not shp_files:
            raise ValueError("No .shp file found in ZIP")
        
        shp_path = os.path.join(tmpdir, shp_files[0])

        gdf = gpd.read_file(shp_path)
        gdf = gdf.to_crs(epsg=4326)

        geom = gdf.geometry.iloc[0]
        return Geometry(geom, crs=CRS.WGS84), gdf


def unzip_and_read_shapefile_ee(zip_path: str):
    """Unzip shapefile ZIP and return EE geometry + shapefile path"""
    if not os.path.exists(zip_path):
        raise FileNotFoundError(f"File not found: {zip_path}")

    tmpdir = tempfile.mkdtemp(prefix="shp_extract_")
    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        zip_ref.extractall(tmpdir)

    # Find .shp
    shp_files = [f for f in os.listdir(tmpdir) if f.endswith(".shp")]
    if not shp_files:
        raise ValueError("No .shp file found in ZIP")
    shp_path = os.path.join(tmpdir, shp_files[0])

    # Read shapefile geometry
    gdf = gpd.read_file(shp_path)
    gdf = gdf.to_crs(epsg=4326)
    
    # If multiple features, create a union
    if len(gdf) > 1:
        geom = gdf.unary_union
    else:
        geom = gdf.geometry.iloc[0]

    # Convert to EE Geometry
    ee_geom = ee.Geometry(geom.__geo_interface__)
    return ee_geom, shp_path

def clip_raster_gdal(input_raster, output_raster, shapefile=None, bbox=None):
    """Clip raster using GDAL with mask layer"""
    try:
        if shapefile:
            # Use Warp with cutline for precise clipping
            warp_options = gdal.WarpOptions(
                cutlineDSName=shapefile,
                cropToCutline=True,
                dstNodata=0,
                format='GTiff',
                creationOptions=['COMPRESS=LZW']
            )
            ds = gdal.Warp(
                output_raster,
                input_raster,
                options=warp_options
            )
        elif bbox:
            minX, minY, maxX, maxY = bbox
            # Use Translate with proper coordinate order
            translate_options = gdal.TranslateOptions(
                projWin=[minX, maxY, maxX, minY],  # ULX, ULY, LRX, LRY
                format='GTiff',
                creationOptions=['COMPRESS=LZW']
            )
            ds = gdal.Translate(
                output_raster,
                input_raster,
                options=translate_options
            )
        else:
            raise ValueError("Provide either shapefile or bbox")

        if ds is None:
            raise RuntimeError("GDAL failed to clip raster")
        
        # Flush cache and close dataset
        ds = None
        return output_raster
        
    except Exception as e:
        logger.error(f"GDAL clipping error: {str(e)}")
        raise
