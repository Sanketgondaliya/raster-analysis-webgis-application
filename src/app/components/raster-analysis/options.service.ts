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
  scaleOptions = [
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
  aspectLegend = [
    { label: 'Flat (-1)', color: '#bfbfbf' },        // Gray
    { label: 'North (0–22.5)', color: '#ff0000' },   // Red
    { label: 'Northeast (22.5–67.5)', color: '#ff9900' }, // Orange
    { label: 'East (67.5–112.5)', color: '#ffff00' },     // Yellow
    { label: 'Southeast (112.5–157.5)', color: '#00ff00' }, // Green
    { label: 'South (157.5–202.5)', color: '#00ffff' },   // Cyan
    { label: 'Southwest (202.5–247.5)', color: '#0000ff' }, // Blue
    { label: 'West (247.5–292.5)', color: '#9900ff' },    // Purple
    { label: 'Northwest (292.5–337.5)', color: '#ff00ff' }, // Magenta
    { label: 'North (337.5–360)', color: '#ff0000' }      // Red again
  ];
  lstLegend = [
    { label: 'Very Cold (<0.2)', color: 'rgb(49, 54, 149)' },
    { label: 'Cold (0.2–0.4)', color: 'rgb(69, 117, 180)' },
    { label: 'Mild (0.4–0.6)', color: 'rgb(120, 198, 121)' },
    { label: 'Hot (0.6–0.8)', color: 'rgb(253, 174, 97)' },
    { label: 'Extreme (>0.8)', color: 'rgb(215, 25, 28)' }
  ];
  lulcLegend = [
    { label: 'Tree cover', color: '#006400' },
    { label: 'Shrubland', color: '#ffbb22' },
    { label: 'Grassland', color: '#ffff4c' },
    { label: 'Cropland', color: '#f096ff' },
    { label: 'Built-up', color: '#fa0000' },
    { label: 'Bare / sparse vegetation', color: '#b4b4b4' },
    { label: 'Snow and ice', color: '#f0f0f0' },
    { label: 'Permanent water bodies', color: '#0064c8' },
    { label: 'Herbaceous wetland', color: '#0096a0' },
    { label: 'Mangroves', color: '#00cf75' },
    { label: 'Moss and lichen', color: '#fae6a0' }
  ];
  constructor() { }
}
