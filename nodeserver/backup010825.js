const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = require('node-fetch');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { exec } = require('child_process');

// Configure multer for file uploads with limits
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 100 * 1024 * 1024,
        files: 1
    }
});

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cors());
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// PostgreSQL pool config with connection timeout
const pool = new Pool({
    user: 'postgres',
    host: '192.168.20.49',
    database: 'gisdb',
    password: 'postgres',
    port: 5432,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000
});

// GeoServer configuration
const GEOSERVER_URL = 'http://192.168.20.49:8080/geoserver/rest';
const GEOSERVER_CREDENTIALS = {
    username: 'admin',
    password: 'geoserver'
};
const GEOSERVER_TIMEOUT = 10000; // 10 seconds


// Helper function to make authenticated requests to GeoServer with timeout
async function makeGeoserverRequest(url, method = 'GET', body = null) {
    const auth = Buffer.from(`${GEOSERVER_CREDENTIALS.username}:${GEOSERVER_CREDENTIALS.password}`).toString('base64');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEOSERVER_TIMEOUT);

    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            signal: controller.signal
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${GEOSERVER_URL}${url}`, options);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`GeoServer request failed: ${response.status} - ${errorText}`);
        }

        return response;
    } finally {
        clearTimeout(timeout);
    }
}


// =========================================
// GET /api/geoserver/workspaces
// Description: Fetches a list of all workspaces from GeoServer
// Usage: Called by frontend or clients to display available workspaces
// =========================================
app.get('/api/geoserver/workspaces', async (req, res) => {
    try {
        // Make a GET request to GeoServer's REST API for all workspaces
        const response = await makeGeoserverRequest('/workspaces.json');

        // Parse the JSON response
        const data = await response.json();

        // Send the workspace data to the client
        res.json(data);
    } catch (error) {
        // Log and return an error if the request fails
        console.error('Error fetching workspaces:', error);
        res.status(500).json({
            error: 'Failed to fetch workspaces',
            details: error.message
        });
    }
});


// ===============================================================
// POST /api/geoserver/workspaces
// Description: Creates a new workspace in GeoServer
// Expected body: { workspaceName: "your_workspace_name" }
// Notes:
//   - Workspace name must be alphanumeric (letters, numbers, underscores only)
//   - GeoServer will reject names with invalid characters
// ===============================================================
app.post('/api/geoserver/workspaces', async (req, res) => {
    try {
        // Destructure workspaceName from the request body
        const { workspaceName } = req.body;

        // Validate workspace name format (only letters, numbers, and underscores allowed)
        if (!workspaceName || !/^[a-zA-Z0-9_]+$/.test(workspaceName)) {
            return res.status(400).json({ 
                error: 'Invalid workspace name. Only alphanumeric and underscore characters are allowed.' 
            });
        }

        // Prepare the request payload for GeoServer
        const requestBody = {
            workspace: {
                name: workspaceName
            }
        };

        // Send a POST request to GeoServer to create the workspace
        const response = await makeGeoserverRequest('/workspaces', 'POST', requestBody);

        // If GeoServer responds with 201 Created, return success
        if (response.status === 201) {
            res.status(201).json({ 
                success: true, 
                message: 'Workspace created successfully' 
            });
        } else {
            // If not 201, fetch and return error text from GeoServer
            const errorText = await response.text();
            res.status(response.status).json({ 
                success: false, 
                message: errorText 
            });
        }
    } catch (error) {
        // Handle unexpected errors
        res.status(500).json({
            success: false,
            message: error.message,
            suggestion: 'Check if workspace already exists or GeoServer is running'
        });
    }
});


// ===============================================================
// GET /api/geoserver/workspaces/:workspace/datastores
// Description: Fetches all datastores within a specified workspace from GeoServer
// Route Params:
//   - workspace: Name of the workspace to retrieve datastores from
// ===============================================================
app.get('/api/geoserver/workspaces/:workspace/datastores', async (req, res) => {
    try {
        // Extract the workspace name from the URL parameters
        const { workspace } = req.params;

        // Make a request to GeoServer to get datastores for the specified workspace
        const response = await makeGeoserverRequest(`/workspaces/${workspace}/datastores.json`);

        // Parse the response JSON from GeoServer
        const data = await response.json();

        // Send the retrieved datastores data back to the client
        res.json(data);
    } catch (error) {
        // Log the error to the server console for debugging
        console.error('Error fetching datastores:', error);

        // Send a 500 Internal Server Error response with error details
        res.status(500).json({
            error: 'Failed to fetch datastores',
            details: error.message
        });
    }
});


// ===============================================================
// POST /api/geoserver/datastores
// Description: Creates a new datastore in a specified GeoServer workspace,
//              typically connecting to a PostGIS database.
// Request Body Parameters:
//   - workspaceName: Name of the workspace to add the datastore to
//   - datastoreName: Name of the new datastore
//   - dbHost: Hostname or IP of the PostgreSQL/PostGIS server
//   - dbPort: Port number of the database server (default 5432)
//   - dbName: Name of the PostgreSQL database
//   - dbUser: Database user with access rights
//   - dbPassword: Password for the database user
// ===============================================================
app.post('/api/geoserver/datastores', async (req, res) => {
    try {
        // Destructure required parameters from the request body
        const { workspaceName, datastoreName, dbHost, dbPort, dbName, dbUser, dbPassword } = req.body;

        // Basic validation: ensure required parameters are present
        if (!workspaceName || !datastoreName || !dbHost || !dbName || !dbUser) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Construct the datastore configuration payload for GeoServer API
        const datastoreConfig = {
            dataStore: {
                name: datastoreName,
                enabled: true,
                connectionParameters: {
                    // Use provided values or fallback defaults
                    host: dbHost || '192.168.20.49',
                    port: dbPort || 5432,
                    database: dbName || 'gisdb',
                    user: dbUser || 'postgres',
                    passwd: dbPassword || 'postgres',
                    dbtype: 'postgis',           // Specify PostGIS database type
                    schema: 'public',            // Default schema
                    validateConnections: true,   // Enable connection validation
                    maxConnections: 10,          // Max DB connections GeoServer can use
                    minConnections: 1            // Min DB connections GeoServer will maintain
                }
            }
        };

        // Send POST request to GeoServer to create the datastore
        const response = await makeGeoserverRequest(
            `/workspaces/${workspaceName}/datastores`,
            'POST',
            datastoreConfig
        );

        // Check for success status and respond accordingly
        if (response.status === 201) {
            res.status(201).json({ success: true, message: 'Datastore created successfully' });
        } else {
            // If GeoServer returns error, extract error message and respond with it
            const errorText = await response.text();
            res.status(response.status).json({ success: false, message: errorText });
        }
    } catch (error) {
        // Handle unexpected errors, return a 500 status with error info
        res.status(500).json({
            success: false,
            message: error.message,
            suggestion: 'Check connection parameters and verify PostgreSQL is accessible from GeoServer'
        });
    }
});

// ===============================================================
// POST /api/import/publish-shp
// Description: Uploads a Shapefile (or ZIP containing shapefile),
//              imports it into PostgreSQL using ogr2ogr,
//              then publishes the layer on GeoServer.
// Expects multipart/form-data with file upload (field name 'file').
// Request body parameters:
//   - workspace: GeoServer workspace to publish to (required)
//   - datastore: GeoServer datastore linked to PostgreSQL (required)
//   - layerName: Optional custom name for the imported layer/table
//   - srid: Optional spatial reference ID, default '4326'
// ===============================================================
app.post('/api/import/publish-shp', upload.single('file'), async (req, res) => {
    let filePath;
    let extractDir = null;
    let shapefilePath = null;

    try {
        // Extract parameters from request
        const { workspace, datastore, layerName, srid = '4326' } = req.body;
        const file = req.file;

        // Validate required inputs
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        if (!workspace || !datastore) {
            return res.status(400).json({ error: 'Workspace and datastore are required' });
        }

        // Get uploaded file path and metadata
        filePath = file.path;
        const originalName = path.basename(file.originalname);

        // Generate table name from layerName or original filename (sanitized)
        const tableName = layerName || originalName.replace(/\.[^/.]+$/, "").replace(/\W/g, '_');

        // File extension in lowercase to handle zip or shp
        const extension = path.extname(file.originalname).toLowerCase();

        console.log(`Processing file: ${originalName}, tableName: ${tableName}`);

        // If ZIP file, extract contents and locate .shp file
        if (extension === '.zip') {
            try {
                extractDir = path.join('uploads', `extracted_${Date.now()}`);
                fs.mkdirSync(extractDir, { recursive: true });

                console.log(`Extracting ZIP to: ${extractDir}`);

                const zip = new AdmZip(filePath);
                zip.extractAllTo(extractDir, true);

                // Search for the shapefile inside extracted directory
                const files = fs.readdirSync(extractDir);
                const shpFile = files.find(f => f.toLowerCase().endsWith('.shp'));

                if (!shpFile) {
                    throw new Error('ZIP file does not contain a .shp file');
                }

                shapefilePath = path.join(extractDir, shpFile);
                console.log(`Found shapefile at: ${shapefilePath}`);
            } catch (extractError) {
                console.error('ZIP extraction failed:', extractError);
                throw new Error(`Failed to process ZIP file: ${extractError.message}`);
            }
        } else if (extension === '.shp') {
            // Directly use the uploaded .shp file path
            shapefilePath = filePath;
        } else {
            throw new Error('Only SHP files or ZIP files containing SHP are supported');
        }

        // Validate presence of shapefile and companion files (.shx, .dbf)
        if (!fs.existsSync(shapefilePath)) {
            throw new Error(`Shapefile not found at path: ${shapefilePath}`);
        }
        const basePath = shapefilePath.replace(/\.shp$/i, '');
        const requiredExtensions = ['.shx', '.dbf'];
        for (const ext of requiredExtensions) {
            if (!fs.existsSync(`${basePath}${ext}`)) {
                throw new Error(`Missing required companion file: ${basePath}${ext}`);
            }
        }

        // Construct ogr2ogr command to import shapefile to PostGIS
        const ogrCommand = `ogr2ogr -f "PostgreSQL" PG:"host=192.168.20.49 user=postgres dbname=gisdb password=postgres" "${shapefilePath}" -nln ${tableName} -t_srs EPSG:${srid} -lco GEOMETRY_NAME=geom -lco FID=gid -nlt PROMOTE_TO_MULTI -overwrite`;

        console.log(`Executing ogr2ogr command: ${ogrCommand}`);

        // Execute ogr2ogr command with a timeout of 5 minutes (300000ms)
        await new Promise((resolve, reject) => {
            const child = exec(ogrCommand, { timeout: 300000 }, (error, stdout, stderr) => {
                if (error) {
                    console.error('ogr2ogr error:', error);
                    console.error('stderr:', stderr);
                    return reject(new Error(`Failed to import shapefile: ${stderr || error.message}`));
                }
                console.log('ogr2ogr output:', stdout);
                resolve();
            });

            // Log child process exit code and signal
            child.on('exit', (code, signal) => {
                console.log(`ogr2ogr process exited with code ${code}, signal ${signal}`);
            });
        });

        console.log('Shapefile imported to database successfully');

        // Publish the layer on GeoServer
        try {
            // Check GeoServer is reachable
            console.log('Checking GeoServer connection...');
            await makeGeoserverRequest('/about/version.json');

            // Feature type URL to check if layer exists
            const featureTypeUrl = `/workspaces/${workspace}/datastores/${datastore}/featuretypes/${tableName}.json`;

            try {
                // Check if layer already exists in GeoServer
                console.log(`Checking if layer ${tableName} already exists...`);
                await makeGeoserverRequest(featureTypeUrl);

                // Update existing layer with new metadata and settings
                console.log(`Updating existing layer ${tableName}...`);
                await makeGeoserverRequest(
                    featureTypeUrl,
                    'PUT',
                    {
                        featureType: {
                            name: tableName,
                            nativeName: tableName,
                            title: tableName,
                            srs: `EPSG:${srid}`,
                            enabled: true,
                            store: {
                                name: datastore,
                                href: `${GEOSERVER_URL}/workspaces/${workspace}/datastores/${datastore}.json`
                            }
                        }
                    }
                );
            } catch (existsError) {
                // If layer not found (404), create a new one
                if (existsError.message.includes('404')) {
                    console.log(`Creating new layer ${tableName}...`);
                    await makeGeoserverRequest(
                        `/workspaces/${workspace}/datastores/${datastore}/featuretypes.json`,
                        'POST',
                        {
                            featureType: {
                                name: tableName,
                                nativeName: tableName,
                                title: tableName,
                                srs: `EPSG:${srid}`,
                                enabled: true,
                                store: {
                                    name: datastore,
                                    href: `${GEOSERVER_URL}/workspaces/${workspace}/datastores/${datastore}.json`
                                }
                            }
                        }
                    );
                } else {
                    throw existsError;
                }
            }

            console.log('Layer successfully published to GeoServer');

            // Respond with success and preview URL for the new layer
            res.json({
                success: true,
                message: 'Shapefile imported and published successfully',
                layerName: `${workspace}:${tableName}`,
                previewUrl: `http://192.168.20.49:8080/geoserver/${workspace}/wms?service=WMS&version=1.1.0&request=GetMap&layers=${workspace}:${tableName}&styles=&bbox=-180,-90,180,90&width=800&height=600&srs=EPSG:4326&format=application/openlayers`
            });

        } catch (geoserverError) {
            // Handle GeoServer communication errors
            console.error('GeoServer communication error:', geoserverError);
            throw new Error(`Failed to publish to GeoServer: ${geoserverError.message}`);
        }

    } catch (error) {
        // Catch all errors during import and publish process
        console.error('Import/publish error:', error);

        let statusCode = 500;
        let errorMessage = error.message;
        let suggestion = 'Please check: 1) GeoServer is running, 2) Correct credentials, 3) Network connectivity';

        // Customize error message and status code based on error type
        if (error.message.includes('ECONNREFUSED')) {
            statusCode = 503;
            errorMessage = 'Cannot connect to GeoServer - is it running?';
        } else if (error.message.includes('401')) {
            statusCode = 401;
            errorMessage = 'GeoServer authentication failed - check credentials';
        } else if (error.message.includes('ogr2ogr')) {
            errorMessage = 'Failed to import shapefile to database';
            suggestion = 'Check PostgreSQL connection and that ogr2ogr is installed';
        }

        // Send error response with details and suggestions
        res.status(statusCode).json({
            error: errorMessage,
            details: error.message,
            suggestion: suggestion
        });
    } finally {
        // Clean up temporary files and directories created during process
        try {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Deleted temporary file: ${filePath}`);
            }
            if (extractDir && fs.existsSync(extractDir)) {
                fs.rmSync(extractDir, { recursive: true });
                console.log(`Deleted temporary directory: ${extractDir}`);
            }
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
        }
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        details: err.message
    });
});


// ===============================================================
// POST /api/geoserver/getDatastoreTable
// Description: Fetches all datastores in a given workspace along with their tables
//              Maintains the original response structure with bounding boxes
// Request Body:
//   {
//     workspaceName: "workspace_name",
//     geoserverurl: "...",
//     username: "...",
//     password: "...",
//     host: "...",
//     port: "...",
//     user: "...",
//     dbpassword: "...",
//     database: "..."
//   }
// Response:
//   {
//     datastores: [
//       {
//         name: "datastore1",
//         tables: [
//           { 
//             name: "table1", 
//             bbox: { minx, miny, maxx, maxy } 
//           }
//         ]
//       }
//     ],
//     metadata: {
//       workspace: "workspace_name",
//       count: X,
//       processingTimeMs: Y
//     }
//   }
// ===============================================================
app.post('/api/geoserver/getDatastoreTable', async (req, res) => {
  const startTime = Date.now();
  const {
    workspaceName: workspace,
    geoserverurl,
    username,
    password,
    host,
    port = 5432,
    user,
    dbpassword,
    database
  } = req.body;

  try {
    // Validate required parameters
    if (!workspace || !geoserverurl || !username || !password) {
      return res.status(400).json({
        error: 'Missing required parameters',
        details: 'workspaceName, geoserverurl, username, and password are required'
      });
    }

    // 1. Get datastores from GeoServer
    const datastoresResponse = await makeGeoserverRequest(
      `/workspaces/${workspace}/datastores.json`,
      'GET',
      null,
      { geoserverurl, username, password }
    );

    if (!datastoresResponse.ok) {
      const errorText = await datastoresResponse.text();
      return res.status(datastoresResponse.status).json({
        error: 'Failed to fetch datastores from GeoServer',
        details: errorText
      });
    }

    const datastoresData = await datastoresResponse.json();
    const datastores = datastoresData.dataStores?.dataStore || [];

    // 2. Process each datastore to get its tables with bounding boxes
    const datastoresWithTables = await Promise.all(
      datastores.map(async (ds) => {
        const datastoreInfo = {
          name: ds.name,
          tables: [],
          errors: []
        };

        // 2a. Get feature types from GeoServer with bounding boxes
        try {
          const featureTypesResponse = await makeGeoserverRequest(
            `/workspaces/${workspace}/datastores/${ds.name}/featuretypes.json`,
            'GET',
            null,
            { geoserverurl, username, password }
          );

          if (featureTypesResponse.ok) {
            const featureTypesData = await featureTypesResponse.json();
            const featureTypes = featureTypesData.featureTypes?.featureType || [];

            // Get detailed info for each feature type including bounding box
            const tablesWithBBox = await Promise.all(
              featureTypes.map(async (ft) => {
                try {
                  const featureDetailResponse = await makeGeoserverRequest(
                    `/workspaces/${workspace}/datastores/${ds.name}/featuretypes/${ft.name}.json`,
                    'GET',
                    null,
                    { geoserverurl, username, password }
                  );

                  if (!featureDetailResponse.ok) {
                    console.warn(`No bbox info for ${ft.name}`);
                    return {
                      name: ft.name,
                      bbox: null,
                      source: 'geoserver'
                    };
                  }

                  const detail = await featureDetailResponse.json();
                  return {
                    name: ft.name,
                    bbox: detail.featureType?.nativeBoundingBox || null,
                    source: 'geoserver'
                  };
                } catch (err) {
                  console.error(`Error fetching bbox for ${ft.name}`, err);
                  return {
                    name: ft.name,
                    bbox: null,
                    error: err.message,
                    source: 'geoserver'
                  };
                }
              })
            );

            datastoreInfo.tables = tablesWithBBox;
          } else {
            datastoreInfo.errors.push(`Failed to fetch GeoServer feature types: ${featureTypesResponse.status}`);
          }
        } catch (error) {
          datastoreInfo.errors.push(`GeoServer error: ${error.message}`);
        }

        // 2b. Get tables from PostgreSQL if credentials provided
        if (host && user && dbpassword) {
          const client = new Client({
            host,
            port,
            user,
            password: dbpassword,
            database: database || workspace.toLowerCase(),
            connectTimeoutMillis: 3000
          });

          try {
            await client.connect();
            
            // Check if schema exists (datastore name often matches schema name)
            const schemaExists = await client.query(
              `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
              [ds.name]
            );

            if (schemaExists.rows.length > 0) {
              const tablesResult = await client.query(
                `SELECT table_name FROM information_schema.tables 
                 WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
                [ds.name]
              );

              // Add PostgreSQL tables (won't have bbox info)
              const pgTables = tablesResult.rows.map(row => ({
                name: row.table_name,
                bbox: null,
                source: 'postgresql'
              }));

              // Combine tables, preferring GeoServer entries for names that exist in both
              const combinedTables = [...datastoreInfo.tables];
              pgTables.forEach(pgTable => {
                if (!combinedTables.some(t => t.name === pgTable.name)) {
                  combinedTables.push(pgTable);
                }
              });

              datastoreInfo.tables = combinedTables;
            }
          } catch (dbError) {
            datastoreInfo.errors.push(`PostgreSQL error: ${dbError.message}`);
          } finally {
            await client.end().catch(() => {});
          }
        }

        return {
          name: datastoreInfo.name,
          tables: datastoreInfo.tables
        };
      })
    );

    // Return response in original format
    res.json({
      datastores: datastoresWithTables,
      metadata: {
        workspace: workspace,
        count: datastoresWithTables.length,
        processingTimeMs: Date.now() - startTime
      }
    });

  } catch (error) {
    console.error('Error in getDatastoreTable endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      suggestion: 'Check GeoServer and database connections'
    });
  }
});


// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`GeoServer URL: ${GEOSERVER_URL}`);
});
