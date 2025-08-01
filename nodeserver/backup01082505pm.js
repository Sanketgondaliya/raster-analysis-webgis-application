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
const { Client } = require('pg');

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

const pgAdminConfig = {
    host: '192.168.20.49',
    port: 5432,
    user: 'postgres',      // superuser or a user with CREATE DATABASE and CREATE EXTENSION privileges
    password: 'postgres',
    database: 'postgres'   // connect to default db to create new databases
};
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        details: err.message
    });
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
// Description: Creates a new workspace in GeoServer and a corresponding PostgreSQL database
//              with the PostGIS extension enabled.
// Expected body: { workspaceName: "your_workspace_name" }
// Notes:
//   - Workspace name must be alphanumeric (letters, numbers, underscores only)
//   - GeoServer will reject names with invalid characters
//   - PostgreSQL database will be created with the same name as the workspace (lowercase)
//   - PostGIS extension is enabled in the created database
// ===============================================================

app.post('/api/geoserver/workspaces', async (req, res) => {
    try {
        debugger
        // Extract workspaceName from the request body
        const { workspaceName } = req.body;

        // Validate workspace name format: only letters, numbers, and underscores are allowed
        if (!workspaceName || !/^[a-zA-Z0-9_]+$/.test(workspaceName)) {
            return res.status(400).json({
                error: 'Invalid workspace name. Only alphanumeric and underscore characters are allowed.'
            });
        }

        // Prepare payload to create workspace in GeoServer
        const requestBody = { workspace: { name: workspaceName } };

        // Send POST request to GeoServer to create the workspace
        const geoResponse = await makeGeoserverRequest('/workspaces', 'POST', requestBody);

        // If GeoServer did not return 201 Created, send back the error response
        if (geoResponse.status !== 201) {
            const errorText = await geoResponse.text();
            return res.status(geoResponse.status).json({
                success: false,
                message: errorText
            });
        }

        // Create a new PostgreSQL client connected to the default database (usually 'postgres')
        const client = new Client(pgAdminConfig);
        await client.connect();

        // Use lowercase workspace name as database name (PostgreSQL usually prefers lowercase)
        const dbName = workspaceName.toLowerCase();

        try {
            // 1. Create a new database with the name equal to the workspace name
            const createDbQuery = `CREATE DATABASE "${dbName}"`;
            await client.query(createDbQuery);

            // Close connection to the default database before connecting to the new one
            await client.end();

            // 2. Connect to the newly created database to enable the PostGIS extension
            const newDbClient = new Client({ ...pgAdminConfig, database: dbName });
            await newDbClient.connect();

            // Enable the PostGIS extension in the new database (if not already enabled)
            await newDbClient.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);

            // Close connection to the new database
            await newDbClient.end();

            // Respond with success message after both workspace and database creation succeed
            return res.status(201).json({
                success: true,
                message: `Workspace and database '${dbName}' created successfully with PostGIS extension`
            });
        } catch (dbError) {
            // If creating the database or enabling PostGIS fails, close the client connection and respond with error
            await client.end();
            return res.status(500).json({
                success: false,
                message: `Workspace created but failed to create database or enable PostGIS: ${dbError.message}`,
                suggestion: 'Check PostgreSQL permissions and ensure the database does not already exist'
            });
        }

    } catch (error) {
        // Catch-all error handler for unexpected failures (GeoServer or PostgreSQL connectivity)
        res.status(500).json({
            success: false,
            message: error.message,
            suggestion: 'Check if workspace already exists or if GeoServer/PostgreSQL are running and accessible'
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
//              connecting to a PostGIS database. Creates schema named after
//              datastoreName inside the database named workspaceName.
// Request Body Parameters:
//   - workspaceName: Name of the workspace (and the database)
//   - datastoreName: Name of the datastore (and schema)
//   - dbHost: Hostname or IP of the PostgreSQL/PostGIS server
//   - dbPort: Port number of the database server (default 5432)
//   - dbUser: Database user with access rights
//   - dbPassword: Password for the database user
// ===============================================================

app.post('/api/geoserver/datastores', async (req, res) => {
    try {
        const {
            workspaceName,
            datastoreName,
            dbHost,
            dbPort = 5432,
            dbUser,
            dbPassword
        } = req.body;

        // Validate required parameters
        if (!workspaceName || !datastoreName || !dbHost || !dbUser) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const dbName = workspaceName.toLowerCase();
        const schemaName = datastoreName;

        // Connect to the database named after workspaceName
        const client = new Client({
            host: dbHost,
            port: dbPort,
            database: dbName,
            user: dbUser,
            password: dbPassword
        });

        await client.connect();

        try {
            // Create schema named after datastoreName if not exists
            const createSchemaQuery = `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`;
            await client.query(createSchemaQuery);
        } catch (dbError) {
            await client.end();
            return res.status(500).json({
                success: false,
                message: `Failed to create schema '${schemaName}': ${dbError.message}`,
                suggestion: 'Check PostgreSQL permissions for the user'
            });
        }

        await client.end();

        // Prepare GeoServer datastore config with schema and database info
        const datastoreConfig = {
            dataStore: {
                name: datastoreName,
                enabled: true,
                connectionParameters: {
                    host: dbHost,
                    port: dbPort,
                    database: dbName,
                    user: dbUser,
                    passwd: dbPassword,
                    dbtype: 'postgis',
                    schema: schemaName,
                    validateConnections: true,
                    maxConnections: 10,
                    minConnections: 1
                }
            }
        };

        // Create datastore in GeoServer
        const response = await makeGeoserverRequest(
            `/workspaces/${workspaceName}/datastores`,
            'POST',
            datastoreConfig
        );

        if (response.status === 201) {
            res.status(201).json({ success: true, message: 'Datastore created successfully' });
        } else {
            const errorText = await response.text();
            res.status(response.status).json({ success: false, message: errorText });
        }
    } catch (error) {
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
//              imports it into PostgreSQL (db = workspace, schema = datastore),
//              with table name always lowercase and prefixed by 'tbl_',
//              then publishes the layer on GeoServer.
// Expects multipart/form-data with file upload (field name 'file').
// Request body parameters:
//   - workspace: GeoServer workspace (and PostgreSQL database name) (required)
//   - datastore: GeoServer datastore (and PostgreSQL schema name) (required)
//   - layerName: Optional custom name for the imported layer/table
//   - srid: Optional spatial reference ID, default '4326'
// ===============================================================
app.post('/api/import/publish-shp', upload.single('file'), async (req, res) => {
    debugger
    let filePath;
    let extractDir = null;
    let shapefilePath = null;

    try {
        const { workspace, datastore, layerName, srid = '4326' } = req.body;
        const file = req.file;

        // Validate inputs
        if (!file) return res.status(400).json({ error: 'No file uploaded' });
        if (!workspace || !datastore) return res.status(400).json({ error: 'Workspace and datastore are required' });

        filePath = file.path;
        const originalName = path.basename(file.originalname);

        // Table name rules: lowercase, starts with 'tbl_'
        const baseLayerName = (layerName || originalName.replace(/\.[^/.]+$/, "")).toLowerCase();
        const tableName = baseLayerName.startsWith('tbl_') ? baseLayerName : `tbl_${baseLayerName}`;

        const extension = path.extname(file.originalname).toLowerCase();

        if (extension === '.zip') {
            extractDir = path.join('uploads', `extracted_${Date.now()}`);
            fs.mkdirSync(extractDir, { recursive: true });
            const zip = new AdmZip(filePath);
            zip.extractAllTo(extractDir, true);
            const files = fs.readdirSync(extractDir);
            const shpFile = files.find(f => f.toLowerCase().endsWith('.shp'));
            if (!shpFile) throw new Error('ZIP file does not contain a .shp file');
            shapefilePath = path.join(extractDir, shpFile);
        } else if (extension === '.shp') {
            shapefilePath = filePath;
        } else {
            throw new Error('Only SHP or ZIP files containing SHP are supported');
        }

        // Validate companion files
        if (!fs.existsSync(shapefilePath)) throw new Error(`Shapefile not found at: ${shapefilePath}`);
        const basePath = shapefilePath.replace(/\.shp$/i, '');
        for (const ext of ['.shx', '.dbf']) {
            if (!fs.existsSync(`${basePath}${ext}`)) throw new Error(`Missing companion file: ${basePath}${ext}`);
        }

        // Construct ogr2ogr command to import shapefile into specified db/schema/table
        // Note: -nln "schema.table" specifies schema and table name for import
        const ogrCommand = `ogr2ogr -f "PostgreSQL" PG:"host=192.168.20.49 user=postgres dbname=${workspace} password=postgres" "${shapefilePath}" -nln "${datastore}.${tableName}" -t_srs EPSG:${srid} -lco GEOMETRY_NAME=geom -lco FID=gid -nlt PROMOTE_TO_MULTI -overwrite`;

        console.log(`Executing ogr2ogr command: ${ogrCommand}`);

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
            child.on('exit', (code, signal) => {
                console.log(`ogr2ogr process exited with code ${code}, signal ${signal}`);
            });
        });

        console.log('Shapefile imported to database successfully');

        // Publish layer on GeoServer
        // Compose full layer name as "workspace:tableName"
        try {
            await makeGeoserverRequest('/about/version.json');

            const featureTypeUrl = `/workspaces/${workspace}/datastores/${datastore}/featuretypes/${tableName}.json`;

            try {
                // Check if layer exists
                await makeGeoserverRequest(featureTypeUrl);

                // Update existing layer
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
                if (existsError.message.includes('404')) {
                    // Create new layer
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

            res.json({
                success: true,
                message: 'Shapefile imported and published successfully',
                layerName: `${workspace}:${tableName}`,
                previewUrl: `${GEOSERVER_URL}/${workspace}/wms?service=WMS&version=1.1.0&request=GetMap&layers=${workspace}:${tableName}&styles=&bbox=-180,-90,180,90&width=800&height=600&srs=EPSG:4326&format=application/openlayers`
            });
        } catch (geoserverError) {
            console.error('GeoServer communication error:', geoserverError);
            throw new Error(`Failed to publish to GeoServer: ${geoserverError.message}`);
        }
    } catch (error) {
        console.error('Import/publish error:', error);

        let statusCode = 500;
        let errorMessage = error.message;
        let suggestion = 'Please check: 1) GeoServer is running, 2) Correct credentials, 3) Network connectivity';

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

        res.status(statusCode).json({
            error: errorMessage,
            details: error.message,
            suggestion: suggestion
        });
    } finally {
        try {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Deleted temporary file: ${filePath}`);
            }
            if (extractDir && fs.existsSync(extractDir)) {
                fs.rmSync(extractDir, { recursive: true, force: true });
                console.log(`Deleted temporary directory: ${extractDir}`);
            }
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
        }
    }
});




// ===============================================================
// POST /api/geoserver/workspaces/:workspace/datastores
// Description: Fetches all datastores in a given workspace,
//              along with their feature types and bounding boxes.
// ===============================================================
app.post('/api/geoserver/workspaces/:workspace/datastores', async (req, res) => {
    const { workspace } = req.params;
    const startTime = Date.now();

    try {
        // Validate workspace parameter presence
        if (!workspace) {
            return res.status(400).json({
                error: 'Workspace parameter is required',
                suggestion: 'Format: /api/geoserver/workspaces/{workspace}/datastores'
            });
        }

        // Request datastores list for the workspace from GeoServer REST API
        const datastoresResponse = await makeGeoserverRequest(`/workspaces/${workspace}/datastores.json`);

        // Handle non-OK response from GeoServer
        if (!datastoresResponse.ok) {
            const errorText = await datastoresResponse.text();

            // Workspace not found (404)
            if (datastoresResponse.status === 404) {
                return res.status(404).json({
                    error: 'Workspace not found',
                    details: errorText
                });
            }
            // Other errors
            throw new Error(errorText);
        }

        // Parse datastores JSON data
        const datastoresData = await datastoresResponse.json();

        // Process each datastore to fetch its feature types and bounding boxes
        const datastoresWithLayers = await Promise.all(
            datastoresData.dataStores.dataStore.map(async (ds) => {
                try {
                    // Fetch feature types for the current datastore
                    const featureTypesResponse = await makeGeoserverRequest(
                        `/workspaces/${workspace}/datastores/${ds.name}/featuretypes.json`
                    );

                    // Handle failure to fetch feature types
                    if (!featureTypesResponse.ok) {
                        console.error(`Failed to get feature types for datastore ${ds.name}`);
                        return {
                            name: ds.name,
                            tables: []  // Empty tables array on failure
                        };
                    }

                    // Parse feature types data (array or single object)
                    const featureTypesData = await featureTypesResponse.json();
                    const featureTypes = featureTypesData.featureTypes?.featureType || [];

                    // For each feature type, fetch detailed info including bounding box
                    const tablesWithBBox = await Promise.all(
                        featureTypes.map(async (ft) => {
                            try {
                                // Fetch detailed feature type information
                                const featureDetailResponse = await makeGeoserverRequest(
                                    `/workspaces/${workspace}/datastores/${ds.name}/featuretypes/${ft.name}.json`
                                );

                                // Handle missing bounding box info gracefully
                                if (!featureDetailResponse.ok) {
                                    console.warn(`No bbox info for ${ft.name}`);
                                    return {
                                        name: ft.name,
                                        bbox: null
                                    };
                                }

                                // Parse detailed feature type JSON response
                                const detail = await featureDetailResponse.json();
                                const bbox = detail.featureType?.nativeBoundingBox || null;

                                return {
                                    name: ft.name,
                                    bbox: bbox
                                };
                            } catch (err) {
                                // Log error but continue processing other feature types
                                console.error(`Error fetching bbox for ${ft.name}`, err);
                                return {
                                    name: ft.name,
                                    bbox: null,
                                    error: err.message
                                };
                            }
                        })
                    );

                    // Return datastore object with its tables and their bounding boxes
                    return {
                        name: ds.name,
                        tables: tablesWithBBox
                    };
                } catch (error) {
                    // Handle error during processing of a datastore
                    console.error(`Error processing datastore ${ds.name}:`, error);
                    return {
                        name: ds.name,
                        tables: [],
                        error: error.message
                    };
                }
            })
        );

        // Return aggregated response including metadata
        res.json({
            datastores: datastoresWithLayers,
            metadata: {
                workspace: workspace,
                count: datastoresWithLayers.length,
                processingTimeMs: Date.now() - startTime
            }
        });

    } catch (error) {
        // General error handler for the route
        res.status(500).json({
            error: 'Failed to fetch datastores',
            details: error.message,
            suggestion: 'Check GeoServer logs for more details'
        });
    }
});

// ===============================================================
// POST /api/get-tables
// Description: Gets all table names from a specified database and schema
// Request Body Parameters:
//   - dbName: Name of the PostgreSQL database (required)
//   - schemaName: Name of the schema (required)
// ===============================================================
app.post('/api/get-tables', async (req, res) => {
    try {
        const { dbName, schemaName } = req.body;

        if (!dbName || !schemaName) {
            return res.status(400).json({ error: 'Both dbName and schemaName are required' });
        }

        const client = new Client({
            ...pgAdminConfig,
            database: dbName
        });

        await client.connect();

        // Query to get the list of table names
        const query = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type = 'BASE TABLE';
    `;
        const result = await client.query(query, [schemaName]);
        const tableNames = result.rows.map(row => row.table_name);

        if (tableNames.length === 0) {
            await client.end();
            return res.json({
                success: true,
                message: `No tables found in schema '${schemaName}' of database '${dbName}'`,
                tables: []
            });
        }

        // Query the data from each table and return it
        const tablesData = [];

        for (const tableName of tableNames) {
            const dataQuery = `SELECT * FROM "${schemaName}"."${tableName}" LIMIT 10`; // Limiting rows for demo
            const tableDataResult = await client.query(dataQuery);
            tablesData.push({
                tableName,
                data: tableDataResult.rows
            });
        }

        await client.end();

        return res.json({
            success: true,
            message: `Tables and data from schema '${schemaName}' of database '${dbName}' fetched successfully`,
            tables: tablesData
        });

    } catch (error) {
        console.error('Error fetching table names and data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tables and data',
            error: error.message
        });
    }
});

app.post('/api/get-columns', async (req, res) => {
    const { dbName, schemaName, tableName } = req.body;

    if (!dbName || !schemaName || !tableName) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    const client = new Pool({
        host: '192.168.20.49',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: dbName
    });

    try {
        const query = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position;
    `;

        const result = await client.query(query, [schemaName, tableName]);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching columns:', err);
        res.status(500).json({ error: 'Failed to fetch columns.' });
    } finally {
        client.end(); // close the dynamic connection
    }
});
app.post('/api/get-chart-data', async (req, res) => {
  const {
    dbName,
    schemaName,
    tableName,
    xColumn,
    yColumn,
    chartType,
    analysisType
  } = req.body;

  if (!dbName || !schemaName || !tableName || !xColumn || !yColumn || !chartType || !analysisType) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const identifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  if (![schemaName, tableName, xColumn, yColumn].every(v => identifierRegex.test(v))) {
    return res.status(400).json({ error: 'Invalid characters in identifiers.' });
  }

  const client = new Pool({
    host: '192.168.20.49',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: dbName,
  });

  try {
    let query = buildQueryForChart(chartType, schemaName, tableName, xColumn, yColumn, analysisType);
    console.log('Query:', query);

    const result = await client.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching chart data:', err);
    res.status(500).json({ error: 'Failed to fetch chart data.' });
  } finally {
    client.end();
  }
});

function buildQueryForChart(chartType, schema, table, xCol, yCol, analysisType) {
  switch (chartType) {
    case 'pie':
      return buildPieChartQuery(schema, table, xCol, yCol, analysisType);
    case 'bar':
      return buildBarChartQuery(schema, table, xCol, yCol, analysisType);
    case 'column':
      return buildColumnChartQuery(schema, table, xCol, yCol, analysisType);
    case 'line':
      return buildLineChartQuery(schema, table, xCol, yCol, analysisType);
    default:
      throw new Error('Unsupported chart type');
  }
}
function buildPieChartQuery(schema, table, xCol, yCol, analysisType) {
  const aggFunc = getAggregateFunction(yCol, analysisType);
  return `
    SELECT "${xCol}" AS label, ${aggFunc} AS value
    FROM "${schema}"."${table}"
    GROUP BY "${xCol}"
    ORDER BY "${xCol}";
  `;
}

function buildBarChartQuery(schema, table, xCol, yCol, analysisType) {
  const aggFunc = getAggregateFunction(yCol, analysisType);
  return `
    SELECT "${xCol}" AS label, ${aggFunc} AS value
    FROM "${schema}"."${table}"
    GROUP BY "${xCol}"
    ORDER BY "${xCol}";
  `;
}

function buildColumnChartQuery(schema, table, xCol, yCol, analysisType) {
  const aggFunc = getAggregateFunction(yCol, analysisType);
  return `
    SELECT "${xCol}" AS label, ${aggFunc} AS value
    FROM "${schema}"."${table}"
    GROUP BY "${xCol}"
    ORDER BY "${xCol}";
  `;
}

function buildLineChartQuery(schema, table, xCol, yCol, analysisType) {
  const aggFunc = getAggregateFunction(yCol, analysisType);
  return `
    SELECT "${xCol}" AS label, ${aggFunc} AS value
    FROM "${schema}"."${table}"
    GROUP BY "${xCol}"
    ORDER BY "${xCol}";
  `;
}
function getAggregateFunction(yCol, analysisType) {
  switch (analysisType) {
    case 'count':
      return `COUNT("${yCol}")`;
    case 'sum':
      return `SUM(CAST("${yCol}" AS NUMERIC))`;
    case 'avg':
      return `AVG(CAST("${yCol}" AS NUMERIC))`;
    case 'min':
      return `MIN(CAST("${yCol}" AS NUMERIC))`;
    case 'max':
      return `MAX(CAST("${yCol}" AS NUMERIC))`;
    case 'distinct':
      return `COUNT(DISTINCT "${yCol}")`;
    default:
      throw new Error('Unsupported analysis type');
  }
}

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`GeoServer URL: ${GEOSERVER_URL}`);
});
