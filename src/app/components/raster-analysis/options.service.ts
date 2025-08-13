import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class OptionsService {
  slopeOptions = [
    { label: 'Percentage', value: 'percentage' },
    { label: 'Degree', value: 'degree' }
  ];
  aspectOptions = [
    { label: 'Azimuthal (0° North)', value: 'azimuthal' },
    { label: 'Trigonometric (0° East)', value: 'trigonometric' }
  ];
  flatAreaHandlingOptions = [
    { label: '-9999', value: '-9999' },
    { label: '0', value: '0' }
  ];

  zFactorOptions = [
    { label: '1', value: 1 },
    { label: '1.5', value: 1.5 },
    { label: '2', value: 2 }
  ];

  demAnalysisTypes = [
    { label: 'Elevation at Point', value: 'point' },
    { label: 'Elevation Profile', value: 'profile' },
    { label: 'Slope Map', value: 'slope', description: 'Calculates slope steepness in degrees or percent' },
    { label: 'Aspect Map', value: 'aspect', description: 'Calculates slope orientation (0-360 degrees)' },
    { label: 'Hillshade', value: 'hillshade', description: 'Creates shaded relief from elevation data' },
    { label: 'Curvature', value: 'curvature', description: 'Calculates profile and planimetric curvature' },
    { label: 'Roughness', value: 'roughness', description: 'Measures surface texture variability' },
    { label: 'TPI (Topographic Position Index)', value: 'tpi', description: 'Compares elevation to local mean' },
    { label: 'Watershed Delineation', value: 'watershed', description: 'Delineates drainage basins' },
    { label: 'Flow Accumulation', value: 'flow_accumulation', description: 'Calculates upstream contributing area' },
    { label: 'Flow Direction', value: 'flow_direction', description: 'Determines drainage direction (D8 algorithm)' },
    { label: 'Wetness Index', value: 'wetness', description: 'Topographic wetness index (ln(a/tanβ))' },
    { label: 'Stream Network', value: 'stream_network', description: 'Extracts channel network from flow accumulation' },
    { label: 'Viewshed Analysis', value: 'viewshed', description: 'Calculates visible areas from observer points' },
    { label: 'Solar Radiation', value: 'solar', description: 'Models incoming solar radiation' },
    { label: 'Terrain Ruggedness', value: 'tri', description: 'Terrain Ruggedness Index' },
    { label: 'Morphometric Features', value: 'morphometry', description: 'Identifies peaks, pits, ridges, etc.' },
    { label: 'Volume Calculation', value: 'volume', description: 'Calculates cut/fill volumes between surfaces' },
    { label: 'Hydrologic Corrected DEM', value: 'hydro_corrected', description: 'Enforces hydrologic consistency' },
    { label: 'Channel Network Distance', value: 'channel_distance', description: 'Distance to nearest stream channel' },
    { label: 'Topographic Wetness', value: 'topo_wetness', description: 'Combines slope and upslope area' },
    { label: '3D Surface Model', value: '3d_surface', description: 'Generates 3D visualization of terrain' },
    { label: 'Contour Lines', value: 'contours', description: 'Generates elevation contour lines' },
    { label: 'Color Relief', value: 'color_relief', description: 'Applies color ramp to elevation values' }
  ];

  demTypes = [
    { label: 'SRTMGL1 (30m)', value: 'SRTMGL1' },
    { label: 'SRTMGL3 (90m)', value: 'SRTMGL3' },
    { label: 'AW3D30 (30m)', value: 'AW3D30' },
    { label: 'COP30 (30m)', value: 'COP30' },
  ];

  colorRamps = [
    { label: 'Grayscale', value: 'grayscale' },
    { label: 'Terrain (ArcGIS)', value: 'terrain' },
    { label: 'Elevation (Topographic)', value: 'elevation' },
    { label: 'NDVI (Vegetation)', value: 'ndvi' },
    { label: 'Viridis', value: 'viridis' },
    { label: 'Plasma', value: 'plasma' },
    { label: 'DEM Standard', value: 'dem' },
    { label: 'Thermal', value: 'thermal' }
  ];

  slopeLegend = [
    { label: 'Very gentle (0–10%)', color: 'rgb(0, 104, 55)' },
    { label: 'Gentle (10–20%)', color: 'rgb(26, 152, 80)' },
    { label: 'Moderate (20–40%)', color: 'rgb(102, 189, 99)' },
    { label: 'Moderate-steep (40–60%)', color: 'rgb(255, 255, 191)' },
    { label: 'Steep (60–80%)', color: 'rgb(253, 174, 97)' },
    { label: 'Very steep (>80%)', color: 'rgb(215, 25, 28)' }
  ];


  constructor() { }
}
