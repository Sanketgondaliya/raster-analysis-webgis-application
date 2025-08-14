import os
from osgeo import gdal, ogr, osr

def generate_contours(dem_path, output_geojson, interval):
    try:
        gdal.AllRegister()
        
        dem_ds = gdal.Open(dem_path)
        if dem_ds is None:
            raise ValueError("Could not open DEM file")

        driver = ogr.GetDriverByName("GeoJSON")
        if os.path.exists(output_geojson):
            driver.DeleteDataSource(output_geojson)

        # Spatial reference from DEM
        srs = osr.SpatialReference()
        srs.ImportFromWkt(dem_ds.GetProjection())

        contour_ds = driver.CreateDataSource(output_geojson)
        contour_layer = contour_ds.CreateLayer("contours", srs=srs, geom_type=ogr.wkbLineString25D)

        field_defn = ogr.FieldDefn("ELEV", ogr.OFTReal)
        contour_layer.CreateField(field_defn)

        gdal.ContourGenerate(
            dem_ds.GetRasterBand(1),
            interval,
            0,
            [],
            1,
            0,
            contour_layer,
            0,
            0
        )

        return True
    except Exception as e:
        print("Error generating contours:", e)
        return False
    finally:
        if 'contour_ds' in locals():
            contour_ds = None
        if 'dem_ds' in locals():
            dem_ds = None