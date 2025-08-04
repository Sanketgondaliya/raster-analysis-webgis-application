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
const os = require('os');
const isWindows = os.platform() === 'win32';

const ogr2ogrPath = isWindows
	? `"C:\\Program Files\\QGIS 3.32.1\\bin\\ogr2ogr.exe"` // Windows path
	: `ogr2ogr`; // Assume installed in PATH on Ubuntu
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
// Error handling middleware
app.use((err, req, res, next) => {
	console.error('Unhandled error:', err);
	res.status(500).json({
		error: 'Internal Server Error',
		details: err.message
	});
});
// GeoServer configuration
const GEOSERVER_URL = 'http://localhost:8080/geoserver/rest';
// Helper function to make authenticated requests to GeoServer with timeout
async function makeGeoserverRequest(endpoint, method = 'GET', body = null, config) {
	const { geoserverurl, username, password } = config;
	const auth = Buffer.from(`${username}:${password}`).toString('base64');

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10000);

	try {
		const options = {
			method,
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Basic ${auth}`
			},
			signal: controller.signal
		};

		if (body) options.body = JSON.stringify(body);

		const baseUrl = geoserverurl.replace(/\/$/, ''); // remove trailing slash
		const response = await fetch(`${baseUrl}/rest${endpoint}`, options);

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
// POST /api/geoserver/workspaces
// Description: Fetches a list of all workspaces from GeoServer
// Usage: Called by frontend clients (Angular) to dynamically list available workspaces (projects).
// Request Body Example:
// {
//   "geoserverurl": "http://localhost:8080/geoserver/",
//   "username": "admin",
//   "password": "geoserver"
// }
// =========================================
app.post('/api/geoserver/workspaces', async (req, res) => {
	try {
		// Destructure geoserver config from request body
		const { geoserverurl, username, password } = req.body;

		// Validate presence of required fields
		if (!geoserverurl || !username || !password) {
			return res.status(400).json({ error: 'Missing GeoServer configuration.' });
		}

		// Make authenticated request to GeoServer to get workspace list
		const response = await makeGeoserverRequest('/workspaces.json', 'GET', null, {
			geoserverurl,
			username,
			password
		});

		// Parse the response from GeoServer
		const data = await response.json();

		// Send the workspace list back to the frontend
		res.json(data);
	} catch (error) {
		// Log any errors and respond with a 500 status
		console.error('Error fetching workspaces:', error);
		res.status(500).json({
			error: 'Failed to fetch workspaces',
			details: error.message
		});
	}
});
// ===============================================================
// POST /api/geoserver/createWorkspaces
// Description:
//   - Creates a new GeoServer workspace using client-provided credentials
//   - Creates a PostgreSQL database with PostGIS enabled using client-provided DB config
// ===============================================================
app.post('/api/geoserver/createWorkspaces', async (req, res) => {
	try {
		// Destructure the entire payload sent from client
		const {
			geoserverurl,
			username,
			password,
			workspaceName,
			host,
			port,
			user,
			dbpassword,
			database
		} = req.body;

		// Validate workspace name
		if (!workspaceName || !/^[a-zA-Z0-9_]+$/.test(workspaceName)) {
			return res.status(400).json({
				error: 'Invalid workspace name. Only alphanumeric and underscore characters are allowed.'
			});
		}

		// 1. Create GeoServer workspace
		const requestBody = { workspace: { name: workspaceName } };

		const geoResponse = await makeGeoserverRequest('/workspaces', 'POST', requestBody, {
			geoserverurl,
			username,
			password
		});

		if (geoResponse.status !== 201) {
			const errorText = await geoResponse.text();
			return res.status(geoResponse.status).json({
				success: false,
				message: errorText
			});
		}

		// 2. Connect to the default DB to create a new DB with PostGIS
		const client = new Client({
			host,
			port,
			user,
			password: dbpassword,
			database // usually 'postgres'
		});

		await client.connect();

		// Use lowercase workspace name for database name
		const dbName = workspaceName.toLowerCase();

		try {
			// Create the new database
			const createDbQuery = `CREATE DATABASE "${dbName}"`;
			await client.query(createDbQuery);

			// Close connection to default DB
			await client.end();

			// Connect to new DB to enable PostGIS
			const newDbClient = new Client({
				host,
				port,
				user,
				password: dbpassword,
				database: dbName
			});

			await newDbClient.connect();

			// Enable PostGIS extension
			await newDbClient.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);

			await newDbClient.end();

			return res.status(201).json({
				success: true,
				message: `Workspace and database '${dbName}' created successfully with PostGIS extension`
			});
		} catch (dbError) {
			await client.end();
			return res.status(500).json({
				success: false,
				message: `Workspace created but failed to create DB or enable PostGIS: ${dbError.message}`,
				suggestion: 'Check DB permissions and if the DB already exists'
			});
		}
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
			suggestion: 'Ensure GeoServer/PostgreSQL are accessible, and the workspace does not already exist'
		});
	}
});

// ===============================================================
// POST /api/geoserver/getDatastoreList
// Description:
//   Fetches all datastores in the given workspace using provided GeoServer config
// Request Body:
//   {
//     projectName: "workspace_name",
//     geoserverurl: "...",
//     username: "...",
//     password: "..."
//   }
// ===============================================================
app.post('/api/geoserver/getDatastoreList', async (req, res) => {
	try {
		const { projectName, geoserverurl, username, password } = req.body;
		if (!projectName || !geoserverurl || !username || !password) {
			return res.status(400).json({ error: 'Missing required GeoServer configuration or project name' });
		}
		// Call GeoServer REST API to get datastores for the workspace
		const response = await makeGeoserverRequest(`/workspaces/${projectName}/datastores.json`, 'GET', null, {
			geoserverurl,
			username,
			password
		});
		const data = await response.json();
		res.json(data);
	} catch (error) {
		console.error('Error fetching datastores:', error);
		res.status(500).json({
			error: 'Failed to fetch datastores',
			details: error.message
		});
	}
});
// ===============================================================
// POST /api/geoserver/createDatastore
// Description:
//   - Creates a PostgreSQL schema inside a database named after workspaceName
//   - Registers a datastore in GeoServer using the schema
// Required Request Body:
//   {
//     workspaceName: "workspace",
//     datastoreName: "schema",
//     dbHost: "localhost",
//     dbPort: 5432,
//     dbUser: "postgres",
//     dbPassword: "password",
//     geoserverurl: "http://localhost:8080/geoserver",
//     username: "admin",
//     password: "geoserver"
//   }
// ===============================================================
app.post('/api/geoserver/createDatastore', async (req, res) => {
	debugger
	try {
		const {
			workspaceName,
			datastoreName,
			dbHost,
			dbPort,
			dbUser,
			dbPassword,
			geoserverurl,
			username,
			password
		} = req.body;

		if (!workspaceName || !datastoreName || !dbHost || !dbUser || !geoserverurl || !username || !password) {
			return res.status(400).json({ error: 'Missing required parameters' });
		}

		const dbName = workspaceName.toLowerCase();  // Use workspaceName as DB name
		const schemaName = datastoreName;

		// Connect to the target DB
		const client = new Client({
			host: dbHost,
			port: dbPort,
			database: dbName,
			user: dbUser,
			password: dbPassword
		});

		await client.connect();

		try {
			// Create schema if it doesn't exist
			await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
		} catch (dbError) {
			await client.end();
			return res.status(500).json({
				success: false,
				message: `Failed to create schema '${schemaName}': ${dbError.message}`
			});
		}

		await client.end();

		// Construct datastore config for GeoServer
		const datastoreConfig = {
			dataStore: {
				name: datastoreName,
				enabled: true,
				connectionParameters: {
					dbtype: 'postgis',
					host: dbHost,
					port: dbPort,
					database: dbName,
					user: dbUser,
					passwd: dbPassword,
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
			datastoreConfig,
			{ geoserverurl, username, password }
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
			suggestion: 'Check connection parameters and verify PostgreSQL & GeoServer accessibility'
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
	let filePath;
	let extractDir = null;
	let shapefilePath = null;

	try {
		const {
			workspace,
			datastore,
			layerName,
			srid = '4326',
			dbHost,
			dbPort = '5432',
			dbUser,
			dbPassword,
			geoserverurl,
			username,
			password
		} = req.body;

		const file = req.file;

		if (!file || !workspace || !datastore || !dbHost || !dbUser || !dbPassword || !geoserverurl || !username || !password) {
			return res.status(400).json({ error: 'Missing required parameters or file.' });
		}

		filePath = file.path;
		const originalName = path.basename(file.originalname);
		const baseLayerName = (layerName || originalName.replace(/\.[^/.]+$/, '')).toLowerCase();
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

		const basePath = shapefilePath.replace(/\.shp$/i, '');
		for (const ext of ['.shx', '.dbf']) {
			if (!fs.existsSync(`${basePath}${ext}`)) {
				throw new Error(`Missing companion file: ${basePath}${ext}`);
			}
		}

		const ogrCommand = `${ogr2ogrPath} -f "PostgreSQL" PG:"host=${dbHost} port=${dbPort} user=${dbUser} dbname=${workspace} password=${dbPassword}" "${shapefilePath}" -nln "${datastore}.${tableName}" -t_srs EPSG:${srid} -lco GEOMETRY_NAME=geom -lco FID=gid -nlt PROMOTE_TO_MULTI -overwrite`;
		console.log(`Executing ogr2ogr command:\n${ogrCommand}`);

		await new Promise((resolve, reject) => {
			exec(ogrCommand, { timeout: 300000 }, (error, stdout, stderr) => {
				if (error) {
					console.error('ogr2ogr error:', stderr || error.message);
					return reject(new Error(`Failed to import shapefile: ${stderr || error.message}`));
				}
				console.log(stdout);
				resolve();
			});
		});

		console.log('Shapefile imported to database successfully.');

		const auth = Buffer.from(`${username}:${password}`).toString('base64');
		const requestGeoServer = async (endpoint, method = 'GET', body = null) => {
			const url = `${geoserverurl.replace(/\/+$/, '')}/rest${endpoint}`;
			const options = {
				method,
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Basic ${auth}`
				}
			};
			if (body) options.body = JSON.stringify(body);
			const response = await fetch(url, options);
			const text = await response.text();
			if (!response.ok) {
				throw new Error(`GeoServer error [${response.status}]: ${text}`);
			}
			return text;
		};

		const featureTypeUrl = `/workspaces/${workspace}/datastores/${datastore}/featuretypes/${tableName}.json`;
		const createUrl = `/workspaces/${workspace}/datastores/${datastore}/featuretypes.json`;

		try {
			console.log(`Checking if feature type exists: ${featureTypeUrl}`);
			await requestGeoServer(featureTypeUrl);
			console.log('Feature type exists. Updating...');
			await requestGeoServer(featureTypeUrl, 'PUT', {
				featureType: {
					name: tableName,
					nativeName: tableName,
					title: tableName,
					srs: `EPSG:${srid}`,
					enabled: true
				}
			});
		} catch (err) {
			if (err.message.includes('404')) {
				console.log('Feature type does not exist. Creating...');
				await requestGeoServer(createUrl, 'POST', {
					featureType: {
						name: tableName,
						nativeName: tableName,
						title: tableName,
						srs: `EPSG:${srid}`,
						enabled: true
					}
				});
			} else {
				throw err;
			}
		}

		res.json({
			success: true,
			message: 'Shapefile imported and published successfully',
			layerName: `${workspace}:${tableName}`,
			previewUrl: `${geoserverurl.replace(/\/+$/, '')}/${workspace}/wms?service=WMS&version=1.1.0&request=GetMap&layers=${workspace}:${tableName}&styles=&bbox=-180,-90,180,90&width=800&height=600&srs=EPSG:4326&format=application/openlayers`
		});
	} catch (error) {
		console.error('Error:', error);
		res.status(500).json({
			error: error.message,
			suggestion: 'Check shapefile, database, or GeoServer credentials and connectivity.'
		});
	} finally {
		try {
			if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
			if (extractDir && fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
		} catch (cleanupError) {
			console.warn('Cleanup error:', cleanupError);
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
		host: 'localhost',
		port: 5432,
		user: 'postgres',
		password: '123',
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
	const { dbName, schemaName, tableName, xColumn, yColumn, chartType } = req.body;

	if (!dbName || !schemaName || !tableName || !xColumn || !yColumn || !chartType) {
		return res.status(400).json({ error: 'Missing required fields.' });
	}

	const identifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
	if (![schemaName, tableName, xColumn, yColumn].every(v => identifierRegex.test(v))) {
		return res.status(400).json({ error: 'Invalid characters in identifiers.' });
	}

	const client = new Pool({
		host: 'localhost',
		port: 5432,
		user: 'postgres',
		password: '123',
		database: dbName,
	});

	let query = '';
	try {
		switch (chartType) {
			case 'pie':
			case 'bar':
			case 'column':
				// Grouped count of Y by X (e.g., departments and number of employees)
				query = `
          SELECT "${xColumn}" AS label, COUNT("${yColumn}") AS value
          FROM "${schemaName}"."${tableName}"
          GROUP BY "${xColumn}"
          ORDER BY "${xColumn}";
        `;
				break;

			case 'line':
				// If Y is numeric (e.g., monthly sales), calculate total or average
				query = `
          SELECT "${xColumn}" AS label, SUM(CAST("${yColumn}" AS NUMERIC)) AS value
          FROM "${schemaName}"."${tableName}"
          GROUP BY "${xColumn}"
          ORDER BY "${xColumn}";
        `;
				break;

			default:
				return res.status(400).json({ error: 'Unsupported chart type.' });
		}

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

// Start server
app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
