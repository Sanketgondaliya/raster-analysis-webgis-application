import traceback
from fastapi import FastAPI, UploadFile, File, Form, HTTPException ,Query
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from services import *
import os
import base64
from fastapi.responses import JSONResponse
from typing import List, Dict, Tuple

from sentinelhub import SHConfig, SentinelHubRequest, MimeType, DataCollection, BBox, CRS
import numpy as np
import rasterio 
from rasterio.transform import from_bounds
import tempfile

import ee
from pydantic import BaseModel, Field

import EVALSCRIPTS

CLIENT_ID = "97fac815-7c69-4ff0-8e3b-5c5cc64c0560"
CLIENT_SECRET = "yqu49iTT8gfXf9hx3FvLRFrAiObUIvR4"

config = SHConfig()
if CLIENT_ID and CLIENT_SECRET:
    config.sh_client_id = CLIENT_ID
    config.sh_client_secret = CLIENT_SECRET



app = FastAPI()


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Define your upload and output folders
UPLOAD_FOLDER = "uploads"
OUTPUT_FOLDER = "outputs"

# Create folders if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)


# Local folder to save results permanently
LOCAL_SAVE_DIR = "saved_tiffs"
os.makedirs(LOCAL_SAVE_DIR, exist_ok=True)


@app.post("/contours")
async def contours(
    file: UploadFile = File(...),
    interval: float = Form(20.0)
):
    """Generate contours as GeoJSON"""
    temp_dem_path = os.path.join(UPLOAD_FOLDER, file.filename)
    with open(temp_dem_path, "wb") as buffer:
        buffer.write(await file.read())

    output_geojson = os.path.join(UPLOAD_FOLDER, 'contours.geojson')

    result = generate_contours(temp_dem_path, output_geojson, interval)

    if result:
        return FileResponse(output_geojson, filename="contours.geojson", media_type="application/geo+json")
    raise HTTPException(status_code=500, detail="Contour generation failed")

@app.post("/hillshade")
async def hillshade(
    file: UploadFile = File(...),
    z_factor: float = Form(1.0),
    azimuth: float = Form(315.0),
    altitude: float = Form(45.0),
    scale: float = Form(1.0)
):
    """Hillshade calculation endpoint with JSON + base64 output"""
    try:
        # Save uploaded file to disk
        temp_dem_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(temp_dem_path, "wb") as buffer:
            buffer.write(await file.read())

        # Run service
        response, status = hillshade_service(
            temp_dem_path, z_factor, azimuth, altitude, scale
        )

        if status != 200:
            raise HTTPException(status_code=status, detail=response.get("error"))

        hillshade_path = response["hillshade_path"]

        # Encode file to base64
        with open(hillshade_path, "rb") as hf:
            file_b64 = base64.b64encode(hf.read()).decode("utf-8")

        return JSONResponse(content={
            "success": True,
            "parameters": {
                "z_factor": z_factor,
                "azimuth": azimuth,
                "altitude": altitude,
                "scale": scale
            },
            "filename": os.path.basename(hillshade_path),
            "file_base64": file_b64
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/aspect")
async def aspect(file: UploadFile = File(...)):
    """Aspect calculation endpoint"""
    try:
        # Save uploaded file to disk
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(file_path, "wb") as f:
            f.write(await file.read())

        # Call service with file path
        response, status = aspect_service(file_path)

        if status != 200:
            raise HTTPException(status_code=status, detail=response.get("error", "Unknown error"))

        aspect_path = response["aspect_path"]

        # Encode output TIFF to base64 (same as slope)
        with open(aspect_path, "rb") as af:
            file_b64 = base64.b64encode(af.read()).decode("utf-8")

        return JSONResponse(content={
            "success": True,
            "parameters": response.get("parameters", {}),
            "filename": os.path.basename(aspect_path),
            "file_base64": file_b64
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/slope")
async def slope(
    file: UploadFile = File(...),
    slope_type: str = Form("degree"),
    z_factor: float = Form(1.0)
):
    try:
        # Save uploaded file
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(file_path, "wb") as f:
            f.write(await file.read())

        # Run slope service
        response, status = slope_service(file_path, slope_format=slope_type, scale=z_factor)
        if status != 200:
            raise HTTPException(status_code=status, detail=response.get("error"))

        slope_path = response["slope_path"]

        # Encode output TIFF to base64
        with open(slope_path, "rb") as sf:
            file_b64 = base64.b64encode(sf.read()).decode("utf-8")

        return JSONResponse(content={
            "success": True,
            "parameters": response["parameters"],
            "filename": os.path.basename(slope_path),
            "file_base64": file_b64
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tpi")
async def tpi_endpoint(
    file: UploadFile = File(...),
    z_factor: float = Form(1.0),
    scale: float = Form(1.0)
):
    """Generate TPI from DEM and return as base64 JSON"""
    try:
        # Save uploaded DEM file
        temp_dem_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(temp_dem_path, "wb") as buffer:
            buffer.write(await file.read())

        # Run TPI service
        response, status = tpi_service(temp_dem_path, z_factor, scale)

        if status != 200:
            raise HTTPException(status_code=status, detail=response.get("error", "TPI calculation failed"))

        output_path = response["output_path"]

        # Encode the output TIFF to base64
        with open(output_path, "rb") as of:
            file_b64 = base64.b64encode(of.read()).decode("utf-8")

        return JSONResponse(content={
            "success": True,
            "parameters": response.get("parameters", {
                "z_factor": z_factor,
                "scale": scale
            }),
            "filename": os.path.basename(output_path),
            "file_base64": file_b64
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TPI generation failed: {str(e)}")

@app.post("/curvature")
async def curvature_endpoint(
    dem: UploadFile = File(...),
    z_factor: float = Form(1.0),
    scale: float = Form(1.0)
):
    """Generate curvature from DEM"""
    try:
        temp_dem_path = os.path.join(UPLOAD_FOLDER, dem.filename)
        with open(temp_dem_path, "wb") as buffer:
            buffer.write(await dem.read())

        response, status = curvature_service(temp_dem_path, z_factor, scale)

        if status != 200:
            raise HTTPException(status_code=status, detail=response.get("error", "Curvature calculation failed"))

        return FileResponse(
            path=response["output_path"],
            filename=os.path.basename(response["output_path"]),
            media_type="image/tiff"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Curvature generation failed: {str(e)}")

@app.post("/roughness")
async def roughness_service_endpoint(
    file: UploadFile = File(...),
    z_factor: float = Form(1.0),
    scale: float = Form(1.0)
):
    """Generate roughness from DEM (JSON + base64 format)"""
    try:
        # Save DEM to disk
        temp_dem_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(temp_dem_path, "wb") as buffer:
            buffer.write(await file.read())

        # Run roughness service
        response, status = roughness_service(temp_dem_path, z_factor, scale)

        if status != 200:
            raise HTTPException(status_code=status, detail=response.get("error", "Roughness calculation failed"))

        output_path = response["output_path"]

        # Encode result TIFF to base64
        with open(output_path, "rb") as rf:
            file_b64 = base64.b64encode(rf.read()).decode("utf-8")

        return JSONResponse(content={
            "success": True,
            "parameters": {
                "z_factor": z_factor,
                "scale": scale
            },
            "filename": os.path.basename(output_path),
            "file_base64": file_b64
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Roughness generation failed: {str(e)}")

@app.post("/ndvi")
async def ndvi_endpoint(
    red_band: UploadFile = File(...),
    nir_band: UploadFile = File(...)
):
    """Calculate NDVI from Red and NIR bands"""
    try:
        print("Starting NDVI calculation...")
        print(f"Received files - Red: {red_band.filename}, NIR: {nir_band.filename}")
        
        # Save uploaded files
        red_path = os.path.join(UPLOAD_FOLDER, red_band.filename)
        nir_path = os.path.join(UPLOAD_FOLDER, nir_band.filename)
        
        print(f"Saving files to: {red_path} and {nir_path}")
        with open(red_path, "wb") as buffer:
            buffer.write(await red_band.read())
        with open(nir_path, "wb") as buffer:
            buffer.write(await nir_band.read())
        print("Files saved successfully")

        print("Calling NDVI service...")
        response, status = ndvi_service(red_path, nir_path)  # Fixed: Changed from ndbi_service to ndvi_service
        
        if status != 200:
            error_msg = response.get("error", "NDVI calculation failed")
            print(f"Error in NDVI calculation: {error_msg}")
            raise HTTPException(status_code=status, detail=error_msg)

        print(f"NDVI calculation successful. Output at: {response['output_path']}")
        return FileResponse(
            path=response["output_path"],
            filename=os.path.basename(response["output_path"]),
            media_type="image/tiff"
        )
        
    except Exception as e:
        print(f"Critical error in NDVI endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"NDVI generation failed: {str(e)}")


@app.post("/ndwi")
async def ndwi_endpoint(
    green_band: UploadFile = File(...),
    nir_band: UploadFile = File(...)
):
    """Calculate NDWI from Green and NIR bands"""
    try:
        # Save uploaded files
        green_path = os.path.join(UPLOAD_FOLDER, green_band.filename)
        nir_path = os.path.join(UPLOAD_FOLDER, nir_band.filename)
        
        with open(green_path, "wb") as buffer:
            buffer.write(await green_band.read())
        with open(nir_path, "wb") as buffer:
            buffer.write(await nir_band.read())

        response, status = ndbi_service(green_path, nir_path)
        
        if status != 200:
            raise HTTPException(status_code=status, detail=response.get("error", "NDWI calculation failed"))

        return FileResponse(
            path=response["output_path"],
            filename=os.path.basename(response["output_path"]),
            media_type="image/tiff"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"NDWI generation failed: {str(e)}")

@app.post("/ndbi")
async def ndbi_endpoint(
    nir_band: UploadFile = File(...),
    swir_band: UploadFile = File(...)
):
    """Calculate NDBI from NIR and SWIR bands"""
    try:
        # Save uploaded files
        nir_path = os.path.join(UPLOAD_FOLDER, nir_band.filename)
        swir_path = os.path.join(UPLOAD_FOLDER, swir_band.filename)
        
        with open(nir_path, "wb") as buffer:
            buffer.write(await nir_band.read())
        with open(swir_path, "wb") as buffer:
            buffer.write(await swir_band.read())

        response, status = ndbi_service(nir_path, swir_path)
        
        if status != 200:
            raise HTTPException(status_code=status, detail=response.get("error", "NDBI calculation failed"))

        return FileResponse(
            path=response["output_path"],
            filename=os.path.basename(response["output_path"]),
            media_type="image/tiff"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"NDBI generation failed: {str(e)}")


@app.post("/elevation_point")
async def elevation_point_endpoint(
    file: UploadFile = File(...),
    longitude: float = Form(...),
    latitude: float = Form(...)
):
    """Get elevation at a specific coordinate"""
    try:
        # Save DEM to disk
        temp_dem_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(temp_dem_path, "wb") as buffer:
            buffer.write(await file.read())

        # Run service
        response, status = elevation_point_service(temp_dem_path, longitude, latitude)
        
        if status != 200:
            raise HTTPException(status_code=status, detail=response.get("error", "Elevation point query failed"))

        # Return consistent JSON format
        return JSONResponse(content={
            "success": True,
            "parameters": {
                "longitude": longitude,
                "latitude": latitude
            },
            "elevation": response.get("elevation")  # Assuming your service returns this key
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Elevation point query failed: {str(e)}")

@app.post("/elevation_profile")
async def elevation_profile_endpoint(

    dem: UploadFile = File(...),
    Longitude1: float = Form(...),
    Latitude1: float = Form(...),
    Longitude2: float = Form(...),
    Latitude2: float = Form(...),
    samples: int = Form(50)
):
    """Get elevation profile between two points"""
    try:
        # Save DEM to disk
        temp_dem_path = os.path.join(UPLOAD_FOLDER, dem.filename)
        with open(temp_dem_path, "wb") as buffer:
            buffer.write(await dem.read())

        # Run elevation profile service
        response, status = elevation_profile_service(
            temp_dem_path, Longitude1, Latitude1, Longitude2, Latitude2, samples
        )

        if status != 200:
            raise HTTPException(
                status_code=status,
                detail=response.get("error", "Elevation profile query failed")
            )
        # Return in a consistent format
        return JSONResponse(content={
            "success": True,
            "parameters": {
                "start_point": [Longitude1, Latitude1],
                "end_point": [Longitude2, Latitude2],
                "samples": samples
            },
            "profile": response.get("profile"),  # Assuming service returns a list of {distance, elevation}

        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Elevation profile query failed: {str(e)}")



@app.get("/landsat_indices")
async def get_index(
    service: str = Query(..., description="ndvi, ndwi, ndbi"),
    bbox: str = Query(..., description="bbox as minX,minY,maxX,maxY"),
    time_start: str = Query(None, description="start date YYYY-MM-DD"),
    time_end: str = Query(None, description="end date YYYY-MM-DD")
):
    if service not in EVALSCRIPTS.EVALSCRIPTS:
        return {"error": "Invalid service. Choose ndvi, ndwi, or ndbi"}

    bbox_coords = [float(x) for x in bbox.split(",")]
    if len(bbox_coords) != 4:
        return {"error": "bbox must be minX,minY,maxX,maxY"}

    bbox_sh = BBox(bbox=bbox_coords, crs=CRS.WGS84)
    time_interval = (time_start, time_end) if time_start and time_end else None

    request = SentinelHubRequest(
       evalscript=EVALSCRIPTS.EVALSCRIPTS[service],  # Changed to access the dictionary
        input_data=[SentinelHubRequest.input_data(
            data_collection=DataCollection.LANDSAT_OT_L2,
            time_interval=time_interval
        )],
        responses=[SentinelHubRequest.output_response("default", MimeType.TIFF)],
        bbox=bbox_sh,
        size=(512, 512),
        config=config
    )

    data = request.get_data()[0]

    # Temporary file for API response
    tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".tiff")
    transform = from_bounds(*bbox_coords, data.shape[1], data.shape[0])

    # Write TIFF
    with rasterio.open(
        tmp_file.name,
        "w",
        driver="GTiff",
        height=data.shape[0],
        width=data.shape[1],
        count=1,
        dtype=data.dtype,
        crs="EPSG:4326",
        transform=transform,
    ) as dst:
        dst.write(data, 1)

    # Save permanently in local folder
    local_file_path = os.path.join(LOCAL_SAVE_DIR, f"{service}.tiff")
    with rasterio.open(
        local_file_path,
        "w",
        driver="GTiff",
        height=data.shape[0],
        width=data.shape[1],
        count=1,
        dtype=data.dtype,
        crs="EPSG:4326",
        transform=transform,
    ) as dst:
        dst.write(data, 1)

    return FileResponse(tmp_file.name, media_type="image/tiff", filename=f"{service}.tiff")

downloader = LSTDataDownloader()
# --- Request model ---
class LSTRequest(BaseModel):
    time_start: str = Field(..., description="Start date in YYYY-MM-DD")
    time_end: str = Field(..., description="End date in YYYY-MM-DD")
    bbox: List[float] = Field(..., description="[minx,miny,maxx,maxy]")


@app.post("/download_lst")
def download_lst(request: LSTRequest):
    """
    Download Land Surface Temperature (LST) for a bounding box and date range.
    Returns the TIFF file directly.
    """
    try:
        if not isinstance(request.bbox, list) or len(request.bbox) != 4:
            raise ValueError("bbox must be [minx,miny,maxx,maxy]")

        coords = [float(c) for c in request.bbox]

        # Build Earth Engine geometry
        region = ee.Geometry.Rectangle(coords)

        # Call downloader → should return dict with "filename"
        result = downloader.download_lst_data(
            start_date=request.time_start,
            end_date=request.time_end,
            region=region,
            scale=100
        )

        if not isinstance(result, dict) or "filename" not in result:
            raise ValueError("Downloader did not return a valid filename")

        tiff_path = result["filename"]

        return FileResponse(
            path=tiff_path,
            filename=os.path.basename(tiff_path),
            media_type="image/tiff",
        )

    except Exception as e:
        print("DEBUG ERROR:\n", traceback.format_exc())
        raise HTTPException(status_code=400, detail=f"{type(e).__name__}: {str(e)}")


lulc_downloader = LULCDataDownloader()

# --- Request model for LULC ---
class LULCRequest(BaseModel):
    bbox: List[float] = Field(..., description="[minx,miny,maxx,maxy]")
    scale: int = 100

@app.post("/download_lulc")
def download_lulc(request: LULCRequest):
    """
    Download Land Use Land Cover (LULC) data for a bounding box.
    Returns the TIFF file directly.
    """
    try:
        if not isinstance(request.bbox, list) or len(request.bbox) != 4:
            raise ValueError("bbox must be [minx,miny,maxx,maxy]")

        coords = [float(c) for c in request.bbox]
        region = ee.Geometry.Rectangle(coords)

        # Call single download
        tiff_path = lulc_downloader.download_lulc_single(
            region=region,
            scale=request.scale
        )

        return FileResponse(
            path=tiff_path,
            filename=os.path.basename(tiff_path),
            media_type="image/tiff",
        )

    except Exception as e:
        print("DEBUG ERROR:\n", traceback.format_exc())
        raise HTTPException(status_code=400, detail=f"{type(e).__name__}: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)
