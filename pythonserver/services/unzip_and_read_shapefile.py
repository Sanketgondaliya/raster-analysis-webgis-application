import os
import tempfile
import zipfile
import geopandas as gpd
from sentinelhub import  CRS, Geometry


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
