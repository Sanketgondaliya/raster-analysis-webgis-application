from fastapi import FastAPI, Query
from fastapi.responses import FileResponse
from sentinelhub import SHConfig, SentinelHubRequest, MimeType, DataCollection, BBox, CRS
import numpy as np
import rasterio
from rasterio.transform import from_bounds
import os
import tempfile

app = FastAPI()

CLIENT_ID = "97fac815-7c69-4ff0-8e3b-5c5cc64c0560"
CLIENT_SECRET = "yqu49iTT8gfXf9hx3FvLRFrAiObUIvR4"

config = SHConfig()
if CLIENT_ID and CLIENT_SECRET:
    config.sh_client_id = CLIENT_ID
    config.sh_client_secret = CLIENT_SECRET

EVALSCRIPTS = {
    "ndvi": """
    //VERSION=3
    function setup() {
        return {input: ["B04","B05"], output: {bands: 1, sampleType: "FLOAT32"}};
    }
    function evaluatePixel(sample) {
        let ndvi = (sample.B05 - sample.B04) / (sample.B05 + sample.B04);
        return [ndvi];
    }
    """,
    "ndwi": """
    //VERSION=3
    function setup() {
        return {input: ["B03","B05"], output: {bands: 1, sampleType: "FLOAT32"}};
    }
    function evaluatePixel(sample) {
        let ndwi = (sample.B03 - sample.B05) / (sample.B03 + sample.B05);
        return [ndwi];
    }
    """,
    "ndbi": """
    //VERSION=3
    function setup() {
        return {input: ["B05","B06"], output: {bands: 1, sampleType: "FLOAT32"}};
    }
    function evaluatePixel(sample) {
        let ndbi = (sample.B06 - sample.B05) / (sample.B06 + sample.B05);
        return [ndbi];
    }
    """
}

# Local folder to save results permanently
LOCAL_SAVE_DIR = "saved_tiffs"
os.makedirs(LOCAL_SAVE_DIR, exist_ok=True)

@app.get("/index")
async def get_index(
    service: str = Query(..., description="ndvi, ndwi, ndbi"),
    bbox: str = Query(..., description="bbox as minX,minY,maxX,maxY"),
    time_start: str = Query(None, description="start date YYYY-MM-DD"),
    time_end: str = Query(None, description="end date YYYY-MM-DD")
):
    if service not in EVALSCRIPTS:
        return {"error": "Invalid service. Choose ndvi, ndwi, or ndbi"}

    bbox_coords = [float(x) for x in bbox.split(",")]
    if len(bbox_coords) != 4:
        return {"error": "bbox must be minX,minY,maxX,maxY"}

    bbox_sh = BBox(bbox=bbox_coords, crs=CRS.WGS84)
    time_interval = (time_start, time_end) if time_start and time_end else None

    request = SentinelHubRequest(
        evalscript=EVALSCRIPTS[service],
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
