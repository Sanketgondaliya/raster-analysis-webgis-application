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
// POST /test-db-connection
// Description:
//   - Tests PostgreSQL database connection using provided credentials
// Request Body:
//   {
//     "host": "localhost",
//     "port": "5432",
//     "user": "postgres",
//     "dbpassword": "123",
//     "database": "postgres"
//   }
// Response:
//   - 200 OK with success: true if connection is successful
//   - 500 Internal Server Error with success: false if connection fails
// ===============================================================
app.post('/api/test-db-connection', async (req, res) => {
	const {
		host,
		port,
		user,
		dbpassword,
		database
	} = req.body;

	const pool = new Pool({
		host,
		port,
		user,
		password: dbpassword,
		database,
		connectionTimeoutMillis: 3000,
	});

	try {
		const client = await pool.connect();
		await client.query('SELECT NOW()');
		client.release();
		res.json({ success: true, message: 'Database connection successful' });
	} catch (error) {
		console.error('Database Connection Error:', error.message); // Better logging
		res.status(500).json({
			success: false,
			message: 'Database connection failed',
			error: error.message
		});
	}
});

// ===============================================================
// POST /api/test-geoserver-connection
// Description:
//   - Tests connection to the GeoServer REST API using credentials
// Request Body:
//   {
//     "geoserverurl": "http://localhost:8080/geoserver/",
//     "username": "admin",
//     "password": "geoserver"
//   }
// Response:
//   - 200 OK if authentication is successful
//   - 500 Error if connection/auth fails
// ===============================================================
app.post('/api/test-geoserver-connection', async (req, res) => {
	const { geoserverurl, username, password } = req.body;

	try {
		const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');

		const response = await fetch(`${geoserverurl}rest/workspaces.json`, {
			method: 'GET',
			headers: {
				'Authorization': `Basic ${basicAuth}`
			},
			timeout: 3000
		});

		if (response.ok) {
			return res.json({
				success: true,
				message: 'GeoServer connection successful'
			});
		} else {
			return res.status(response.status).json({
				success: false,
				message: 'GeoServer responded with error',
				statusCode: response.status
			});
		}
	} catch (error) {
		console.error('GeoServer Connection Error:', error.message);
		return res.status(500).json({
			success: false,
			message: 'GeoServer connection failed',
			error: error.message
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
// POST /api/geoserver/getDatastoreTable
// Description: Fetches all datastores in a given workspace along with their tables
// Request Body:
//   {
//     workspaceName: "workspace_name",  // Required
//     geoserverurl: "...",             // Required
//     username: "...",                 // Required
//     password: "...",                 // Required
//     host: "...",                     // Optional (for PostgreSQL integration)
//     port: "...",                     // Optional
//     user: "...",                     // Optional
//     dbpassword: "...",               // Optional
//     database: "..."                  // Optional
//   }
// Response:
//   {
//     success: boolean,
//     datastores: [
//       {
//         name: "datastore1",
//         tables: [
//           { name: "table1", type: "featureType" },
//           { name: "table2", type: "postgresTable" }
//         ]
//       }
//     ]
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
		// Validation
		if (!workspace || !geoserverurl || !username || !password) {
			return res.status(400).json({
				success: false,
				error: 'Missing required parameters',
				details: 'workspaceName, geoserverurl, username, and password are required'
			});
		}

		// --- Fetch datastores from GeoServer
		const datastoresResponse = await makeGeoserverRequest(
			`/workspaces/${workspace}/datastores.json`,
			'GET',
			null,
			{ geoserverurl, username, password }
		);

		if (!datastoresResponse.ok) {
			const errorText = await datastoresResponse.text();
			return res.status(datastoresResponse.status).json({
				success: false,
				error: 'Failed to fetch datastores from GeoServer',
				details: errorText
			});
		}

		const datastoresJson = await datastoresResponse.json();
		const datastores = datastoresJson.dataStores?.dataStore || [];

		// --- Process each datastore
		const datastoresWithTables = await Promise.all(datastores.map(async (ds) => {
			const info = {
				name: ds.name,
				tables: []
			};

			// -- GeoServer feature types
			try {
				const ftResponse = await makeGeoserverRequest(
					`/workspaces/${workspace}/datastores/${ds.name}/featuretypes.json`,
					'GET',
					null,
					{ geoserverurl, username, password }
				);

				if (ftResponse.ok) {
					const ftData = await ftResponse.json();
					const featureTypes = ftData.featureTypes?.featureType || [];

					const tables = await Promise.all(featureTypes.map(async (ft) => {
						try {
							const detailResp = await makeGeoserverRequest(
								`/workspaces/${workspace}/datastores/${ds.name}/featuretypes/${ft.name}.json`,
								'GET',
								null,
								{ geoserverurl, username, password }
							);

							const detail = detailResp.ok ? await detailResp.json() : null;
							return {
								name: ft.name,
								bbox: detail?.featureType?.nativeBoundingBox || null,
								source: 'geoserver'
							};
						} catch (e) {
							return { name: ft.name, bbox: null, source: 'geoserver', error: e.message };
						}
					}));

					info.tables = tables;
				}
			} catch (e) {
				// continue silently
			}

			// -- PostgreSQL tables (if DB info exists)
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

					const schemaExists = await client.query(
						`SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
						[ds.name]
					);

					if (schemaExists.rows.length > 0) {
						const pgTablesResult = await client.query(
							`SELECT table_name FROM information_schema.tables 
               WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
							[ds.name]
						);

						const pgTables = pgTablesResult.rows.map(row => ({
							name: row.table_name,
							bbox: null,
							source: 'postgresql'
						}));

						// Merge without duplicates
						const existingNames = info.tables.map(t => t.name);
						pgTables.forEach(pg => {
							if (!existingNames.includes(pg.name)) info.tables.push(pg);
						});
					}

				} catch (err) {
					console.warn(`PostgreSQL error for datastore ${ds.name}:`, err.message);
				} finally {
					await client.end().catch(() => { });
				}
			}

			return info;
		}));

		// Final structured response
		return res.json({
			success: true,
			datastores: datastoresWithTables,
			metadata: {
				workspace,
				count: datastoresWithTables.length,
				processingTimeMs: Date.now() - startTime
			}
		});

	} catch (error) {
		console.error('Fatal error in /getDatastoreTable:', error);
		return res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error.message
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
// Node.js/Express + PostgreSQL
app.post('/api/get-tables', async (req, res) => {
	try {
		const {
			host,
			port,
			user,
			dbpassword,
			projectName,
			schemaName
		} = req.body;

		if (!host || !port || !user || !dbpassword || !projectName || !schemaName) {
			return res.status(400).json({
				success: false,
				message: 'Missing one or more required parameters: host, port, user, dbpassword, projectName, schemaName'
			});
		}

		const client = new Client({
			host,
			port,
			user,
			password: dbpassword,
			database: projectName,
			ssl: false // Set to true if you're using SSL connections
		});

		await client.connect();

		// Get tables from schema
		const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1 AND table_type = 'BASE TABLE';
    `, [schemaName]);

		const tableNames = tablesResult.rows.map(row => row.table_name);

		const tablesData = [];

		for (const tableName of tableNames) {
			const result = await client.query(`SELECT * FROM "${schemaName}"."${tableName}" LIMIT 10`);
			tablesData.push({
				tableName,
				data: result.rows
			});
		}

		await client.end();

		res.json({
			success: true,
			message: `Fetched ${tableNames.length} tables from schema '${schemaName}'`,
			tables: tablesData
		});

	} catch (err) {
		console.error('Database fetch error:', err);
		res.status(500).json({
			success: false,
			message: 'Error fetching tables or data',
			error: err.message
		});
	}
});

/**
 * POST /api/get-columns
 * Description: Gets all columns with their data types from a specified table
 * Request Body Parameters:
 *   - host: Database host (required)
 *   - port: Database port (required)
 *   - user: Database user (required)
 *   - dbpassword: Database password (required)
 *   - dbName: Database name (required)
 *   - schemaName: Schema name (required)
 *   - tableName: Table name (required)
 */
app.post('/api/get-columns', async (req, res) => {
    // Validate required parameters
    const requiredParams = ['host', 'port', 'user', 'dbpassword', 'dbName', 'schemaName', 'tableName'];
    const missingParams = requiredParams.filter(param => !req.body[param]);

    if (missingParams.length > 0) {
        return res.status(400).json({
            success: false,
            message: `Missing required parameters: ${missingParams.join(', ')}`
        });
    }

    const { host, port, user, dbpassword, dbName, schemaName, tableName } = req.body;
    let client;

    try {
        // Create and connect to client
        client = new Client({
            host,
            port: parseInt(port),
            user,
            password: dbpassword,
            database: dbName,
            ssl: false
        });

        await client.connect();

        // Get columns with extended information
        const query = `
            SELECT 
                column_name, 
                data_type,
                is_nullable,
                column_default,
                character_maximum_length,
                numeric_precision,
                numeric_scale
            FROM information_schema.columns
            WHERE table_schema = $1 
            AND table_name = $2
            ORDER BY ordinal_position;
        `;

        const result = await client.query(query, [schemaName, tableName]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Table '${schemaName}.${tableName}' not found or has no columns`
            });
        }

        res.json({
            success: true,
            message: `Found ${result.rows.length} columns in table '${schemaName}.${tableName}'`,
            columns: result.rows
        });

    } catch (err) {
        console.error('Database operation error:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching columns',
            error: err.message
        });
    } finally {
        if (client) {
            try {
                await client.end();
            } catch (err) {
                console.error('Error closing database connection:', err);
            }
        }
    }
});

/**
 * POST /api/get-chart-data
 * Description: Gets formatted data for visualization charts
 * Request Body Parameters:
 *   - host: Database host (required)
 *   - port: Database port (required)
 *   - user: Database user (required)
 *   - dbpassword: Database password (required)
 *   - dbName: Database name (required)
 *   - schemaName: Schema name (required)
 *   - tableName: Table name (required)
 *   - xColumn: Column for X-axis (required)
 *   - yColumn: Column for Y-axis (required)
 *   - chartType: Type of chart (pie|bar|column|line) (required)
 */
app.post('/api/get-chart-data', async (req, res) => {
    try {
        const { 
            host, port, user, dbpassword, dbName,
            schemaName, tableName, xColumn, yColumn, chartType
        } = req.body;

        // Validate required parameters
        const requiredParams = ['host', 'port', 'user', 'dbpassword', 'dbName',
                              'schemaName', 'tableName', 'xColumn', 'yColumn', 'chartType'];
        const missingParams = requiredParams.filter(param => !req.body[param]);
        
        if (missingParams.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required parameters: ${missingParams.join(', ')}`
            });
        }

        // Validate identifiers to prevent SQL injection
        const identifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
        const invalidIdentifiers = [schemaName, tableName, xColumn, yColumn]
            .filter(v => !identifierRegex.test(v));
        
        if (invalidIdentifiers.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid characters in identifiers: ${invalidIdentifiers.join(', ')}`
            });
        }

        // Validate chart type
        const validChartTypes = ['pie', 'bar', 'column', 'line'];
        if (!validChartTypes.includes(chartType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid chart type. Must be one of: ${validChartTypes.join(', ')}`
            });
        }

        const client = new Client({
            host,
            port: parseInt(port),
            user,
            password: dbpassword,
            database: dbName,
            ssl: false
        });

        await client.connect();

        // Build query based on chart type
        let query;
        if (chartType === 'pie' || chartType === 'bar' || chartType === 'column') {
            query = `
                SELECT 
                    "${xColumn}" AS label, 
                    COUNT("${yColumn}")::integer AS value
                FROM "${schemaName}"."${tableName}"
                WHERE "${xColumn}" IS NOT NULL
                GROUP BY "${xColumn}"
                ORDER BY COUNT("${yColumn}") DESC
                LIMIT 50;
            `;
        } else if (chartType === 'line') {
            query = `
                SELECT 
                    "${xColumn}" AS label, 
                    SUM(CAST("${yColumn}" AS NUMERIC)) AS value
                FROM "${schemaName}"."${tableName}"
                WHERE "${xColumn}" IS NOT NULL
                GROUP BY "${xColumn}"
                ORDER BY "${xColumn}"
                LIMIT 1000;
            `;
        }

        console.log('Executing query:', query);
        const result = await client.query(query);
        await client.end();

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No data available for the specified columns and chart type'
            });
        }

        // Convert numeric strings to numbers for chart libraries
        const formattedData = result.rows.map(item => ({
            label: item.label,
            value: Number(item.value) || 0
        }));

        res.json({
            success: true,
            message: `Retrieved ${formattedData.length} data points for ${chartType} chart`,
            chartType,
            data: formattedData
        });

    } catch (err) {
        console.error('Database operation error:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching chart data',
            error: err.message
        });
    }
});

// Start server
app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
