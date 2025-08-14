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