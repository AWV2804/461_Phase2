/**
 * This module sets up an Express server with various endpoints for handling package management operations.
 * It includes endpoints for uploading packages, resetting the database, rating packages, and more.
 * The server also integrates with Swagger for API documentation and uses various utilities for processing packages.
 * 
 * @module openAPI_controller
 * 
 * @requires express
 * @requires swagger-jsdoc
 * @requires swagger-ui-express
 * @requires ./utils.js
 * @requires ./database
 * @requires ./rate.js
 * @requires cors
 * @requires ./logging.js
 * @requires adm-zip
 * @requires dotenv
 * @requires crypto-js/sha256
 * @requires isomorphic-git
 * @requires isomorphic-git/http/node
 * @requires fs
 * @requires path
 * @requires ./s3_utils
 * @requires esbuild
 * 
 * @constant {string[]} possibleReadmeFiles - List of possible README file names.
 * @constant {string} monkeyBusiness - A hardcoded bearer token for authentication.
 * @constant {object} app - Express application instance.
 * @constant {number} FRONTEND_PORT - Port number for the frontend connection.
 * @constant {number} BACKEND_PORT - Port number for the backend server.
 * @constant {object} swaggerOptions - Configuration options for Swagger.
 * @constant {object} swaggerDocs - Swagger documentation generated from swaggerOptions.
 * 
 * @function app.delete('/reset') - Endpoint to reset the database.
 * @function app.post('/package') - Endpoint to upload a package and calculate its score.
 * @function app.get('/package/:id/rate') - Endpoint to rate a package.
 * @function app.put('/authenticate') - Endpoint to authenticate a user.
 * @function app.get('/package/:id') - Endpoint to retrieve package information.
 * @function app.post('/package/:id') - Endpoint to update a package.
 * @function app.post('/package/byRegEx') - Endpoint to find packages by regular expression.
 * @function app.get('/package/:id/cost') - Endpoint to get the cost of a package.
 * @function app.post('/packages') - Endpoint to search for packages.
 * @function app.get('/tracks') - Endpoint to get implemented track.
 * @function app.post('/create-account') - Endpoint to create a new user account.
 * @function app.delete('/delete-account') - Endpoint to delete a user account.
 */
import express from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import * as util from './utils.js';
import * as db from './database.js';
import { rate } from './rate.js';
import cors from 'cors';
import logger from './logging.js';
import AdmZip from 'adm-zip';
import dotenv from 'dotenv';
import SHA256 from 'crypto-js/sha256.js';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node/index.cjs';
import fs from 'fs';
import path from 'path';
import * as s3 from './s3_utils.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const possibleReadmeFiles = [
    'README.md',
    'README',
    'README.txt',
    'README.rst',
    'README.markdown',
    'readme.markdown',
    'README.html',
    'readme.md',
    'Readme.md'
];

export const app = express();
export let packageDB;
export let userDB;
let Package;
let UserModel;
function initializeDatabases() {
  if (!packageDB) {
    console.log('Initializing packageDB...');
    packageDB = db.connectToMongoDB("Packages");
  }
  if (!userDB) {
    console.log('Initializing userDB...');
    userDB = db.connectToMongoDB("Users");
  }
}

app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));
dotenv.config();
// Frontend connnection setup
const FRONTEND_PORT = process.env.PORT || 3001;
app.use(cors({
    origin: [`http://localhost:${FRONTEND_PORT}`, `http://${process.env.EC2_IP_ADDRESS}:${FRONTEND_PORT}`],// Frontend's URL
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true, // If you need to send cookies or auth headers
  }));
console.log(`Frontend is running on port ${FRONTEND_PORT}`);

// Backend config setup
const BACKEND_PORT = process.env.REACT_APP_BACKEND_PORT || 3000;

app.listen(BACKEND_PORT, () => {
    console.log(`Server is running on port ${BACKEND_PORT}`);
});

console.log(`OpenAPI_controller.ts(40): ADD "PORT=${FRONTEND_PORT}" and "REACT_APP_BACKEND_PORT=${BACKEND_PORT}" to your .env or things could potentially break. Then delete this console.log.`);
console.log("Also add BACKEND_PORT to be forwarded in Vscode ports");

const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.2',
        info: {
            title: 'PackageManagerAPI',
            description: 'API to handle package manager requests',
            contact: {
                name: 'nkim12303@gmail.com, atharvarao100@gmail.com, andrewtu517@gmail.com, adhvik.kannan@gmail.com'
            },
            version: '1.0.0',
            servers: [
                {
                    url: `localhost:${BACKEND_PORT}`, 
                },
                {
                    url: `https://${process.env.EC2_IP_ADDRESS}`,
                }
            ]
        }
    },
    apis: ['./src/*.ts'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
app.use((req, res, next) => {
    initializeDatabases(); // Ensure the databases are initialized
    Package = packageDB[1].model('Package', db.packageSchema);
    UserModel = userDB[1].model('User', db.userSchema);
    next();
});


app.delete('/reset', async (req, res) => {
    const authToken = (req.headers['X-Authorization'] || req.headers['x-authorization']) as string;
    if(!authToken || authToken == '' || authToken == null || authToken.trim() == '') {
        logger.error('Missing Authentication Header');
        return res.status(403).send('Missing Authentication Header');
    }
    try {
        logger.info("Verifying token");
        const {updatedToken, isAdmin, userGroup} = util.verifyToken(authToken);
        if(updatedToken instanceof Error) {
            logger.error('Invalid or expired token');
            return res.status(403).send(`Invalid or expired token: ${updatedToken}`);
        }
        if(isAdmin != true) {
            logger.error('You do not have the correct permissions to reset the registry.');
            return res.status(403).send('You do not have the correct permissions to reset the registry.');
        }
        logger.info('Token verified');
    } catch (error) {
        logger.error('Error verifying token:', error);
        return res.status(403).send('Invalid or expired token');
    }
    try {
        logger.info('Resetting registry...');
        console.log(Package);
        console.log(UserModel);
        const numPacks = await Package.countDocuments();
        const numUsers = await UserModel.countDocuments();
        console.log(numPacks);
        console.log(numUsers);
        if (numPacks == 0 && numUsers == 1) {
            logger.info('Registry is already empty');
            return res.status(200).send('Registry has been reset.');
        }
        let result;
        let result2;
        if (numPacks != 0) {
            result = await db.deleteDB(packageDB[1]);
        } else {
            result = [true, 'No collections to delete'];
        }
        if (numUsers != 1) {
            result2 = await db.deleteUsersExcept(UserModel);
        } else {
            result2 = [true, 'No collections to delete'];
        }
        await s3.clearS3Bucket();
        console.log(`Registry values: ${result}, ${result2}`);
        logger.debug(`Registry values: ${result}, ${result2}`);
        if (result[0] == true && result2[0] == true) {
            logger.info('Registry is reset.');
            return res.status(200).send('Registry has been reset.');
        } else if(result[0] == false) {
            logger.error('Error deleting database:', result[1]);
            return res.status(500).send('Error deleting database');
        } else if(result2[0] == false) {
            logger.error('Error deleting user:', result2[1]);
            return res.status(500).send('Error deleting user');
        }
    } catch (error) {
        logger.error('Error deleting database:', error);
        return res.status(500).send('Error deleting database');
    }
});

app.post('/package/byRegEx', async (req, res) => {
    const authToken = (req.headers['X-Authorization'] || req.headers['x-authorization']) as string;
    if(!authToken || authToken == '' || authToken == null || authToken.trim() == '') {
        logger.error('Authentication failed due to invalid or missing AuthenticationToken');
        return res.status(403).send('Authentication failed due to invalid or missing AuthenticationToken');
    }
    try {
        const {updatedToken, isAdmin, userGroup} = util.verifyToken(authToken);
        if(updatedToken instanceof Error) {
            logger.error('Invalid or expired token');
            return res.status(403).send(`Invalid or expired token: ${updatedToken}`);
        }
        if(isAdmin != true) {
            logger.error('You do not have the correct permissions to reset the registry.');
            return res.status(403).send('You do not have the correct permissions to reset the registry.')
        }
        logger.info('Token verified');
    } catch (error) {
        logger.error('Error verifying token:', error);
        return res.status(403).send('Invalid or expired token');
    }
    const { RegEx } = req.body;
    if (!RegEx) {
        logger.error('Malformed Request');
        return res.status(400).json({ error: 'Malformed Request' });
    }
    const [success, packages] = await db.findPackageByRegEx(RegEx, Package);
    if (!success) {
        logger.error('Error retrieving packages:', packages);
        return res.status(500).send('Error retrieving packages');
    }
    if(packages.length == 0) {
        logger.info('No packages found');
        return res.status(404).send('No packages found');
    }
    const formattedPackages = packages.map((pkg: any) => ({
        Version: pkg.version,
        Name: pkg.name,
        ID: pkg.packageId, // Use packageId if available, fallback to id
    }));
    logger.debug('Packages found:', formattedPackages);
    return res.status(200).json(formattedPackages);
});


app.get('/package//rate', async (req, res) => {
    const authToken = (req.headers['X-Authorization'] || req.headers['x-authorization']) as string;
    if(!authToken || authToken == '' || authToken == null || authToken.trim() == '') {
        logger.error('Missing Authentication Header');
        return res.status(403).send('Missing Authentication Header');
    }
    try {
        const {updatedToken, isAdmin, userGroup} = util.verifyToken(authToken);
        if(updatedToken instanceof Error) {
            logger.error('Invalid or expired token');
            return res.status(403).send(`Invalid or expired token: ${updatedToken}`);
        }
        if(isAdmin != true) {
            logger.error('You do not have the correct permissions to reset the registry.');
            return res.status(403).send('You do not have the correct permissions to reset the registry.')
        }
    } catch (error) {
        logger.error('Error verifying token:', error);
        return res.status(403).send('Invalid or expired token');
    }
    
    return res.status(400).send('Missing package ID');
});

app.get('/package/:id/rate', async (req, res) => {
    const authToken = (req.headers['X-Authorization'] || req.headers['x-authorization']) as string;
    if(!authToken || authToken == '' || authToken == null || authToken.trim() == '') {
        logger.error('Missing Authentication Header');
        return res.status(403).send('Missing Authentication Header');
    }
    try {
        const {updatedToken, isAdmin, userGroup} = util.verifyToken(authToken);
        if(updatedToken instanceof Error) {
            logger.error('Invalid or expired token');
            return res.status(403).send(`Invalid or expired token: ${updatedToken}`);
        }
        if(isAdmin != true) {
            logger.error('You do not have the correct permissions to reset the registry.');
            return res.status(403).send('You do not have the correct permissions to reset the registry.')
        }
    } catch (error) {
        logger.error('Error verifying token:', error);
        return res.status(403).send('Invalid or expired token');
    }
    const packageId = req.params.id;
    console.log(packageId);
    if(packageId.trim() === '' || packageId == null || packageId == undefined || !packageId) {
        logger.error('Missing package ID');
        return res.status(400).send('Missing package ID');
    }
    const packageInfo = await db.getPackagesByNameOrHash(packageId, Package);
    if (!packageInfo[0] && packageInfo[1][0] == -1) {
        logger.error('Package not found:', packageInfo[1]);
        return res.status(404).send('Package not found: ' + packageInfo[1]);
    } else if(!packageInfo[0]) {
        logger.error('Error retrieving package:', packageInfo[1]);
        return res.status(500).send(`Error retrieving package: ${packageInfo[1]}`);
    }
    const pkg = packageInfo[1] as any[];
    console.log(pkg[0]["score"]);
    const scoreObject = JSON.parse(pkg[0]["score"]);
    const nullFields = Object.keys(scoreObject).filter(key => scoreObject[key] === null);
    if(nullFields.length > 0) {
        logger.error('Package rating choked');
        return res.status(500).send('Package rating choked');
    }
    const jsonResponse = {
        BusFactor: scoreObject["BusFactor"],
        BusFactorLatency: scoreObject["BusFactor_Latency"],
        Correctness: scoreObject["Correctness"],
        CorrectnessLatency: scoreObject["Correctness_Latency"],
        RampUp: scoreObject["RampUp"],
        RampUpLatency: scoreObject["RampUp_Latency"],
        ResponsiveMaintainer: scoreObject["ResponsiveMaintainer"],
        ResponsiveMaintainerLatency: scoreObject["ResponsiveMaintainer_Latency"],
        LicenseScore: scoreObject["License"],
        LicenseScoreLatency: scoreObject["License_Latency"],
        GoodPinningPractice: scoreObject["DependencyPinning"],
        GoodPinningPracticeLatency: scoreObject["DependencyPinning_Latency"],
        PullRequest: scoreObject["PullRequestsCodeMetric"],
        PullRequestLatency: scoreObject["PullRequestsCodeMetric_Latency"],
        NetScore: scoreObject["NetScore"],
        NetScoreLatency: scoreObject["NetScore_Latency"],
    };
    logger.debug('Package rated successfully:', jsonResponse);
    return res.status(200).json(jsonResponse);
});

app.get('/package/:id?', async (req, res) => {
    try {
        const authToken = (req.headers['X-Authorization'] || req.headers['x-authorization']) as string
        if(!authToken || authToken == '' || authToken == null || authToken.trim() == '') {
            logger.info('Authentication failed due to invalid or missing AuthenticationToken');
            return res.status(403).send('Authentication failed due to invalid or missing AuthenticationToken');
        } 
        const { updatedToken, isAdmin, userGroup } = util.verifyToken(authToken);
        try {
            if (updatedToken instanceof Error) {
                logger.info('Invalid or expired token');
                return res.status(403).send(`Invalid or expired token`);
            }
        } catch (error) {
            logger.error('Error verifying token:', error);
            return res.status(403).send('Invalid or expired token');
        }
        logger.info('Token verified');
        const packageID = req.params.id;
        if (!packageID || typeof packageID !== 'string' || packageID.trim() === '') {
            logger.error('There is missing field(s) in the PackageID or it is formed improperly, or it is invalid.');
            return res.status(400).send('There is missing field(s) in the PackageID or it is formed improperly, or it is invalid.');
        }
        const packageInfo = await db.getPackagesByNameOrHash(packageID, Package);
        if (!packageInfo[0] && packageInfo[1][0] == -1) {
            logger.error('Package not found:', packageInfo[1]);
            return res.status(404).send('Package not found: ' + packageInfo[1]);
        } else if(!packageInfo[0]) {
            logger.error('Error fetching package:', packageInfo[1]);
            return res.status(500).send('Error fetching package: ' + packageInfo[1]);
        }
        if(packageInfo[1]["secret"] && packageInfo[1]["userGroup"] != userGroup) {
            logger.error("No access: Wrong user group");
            return res.status(403).send("No access: Wrong user group"); 
        }
        const packInfo = packageInfo[1] as any[];
        const packageContentBuffer = await s3.requestContentFromS3(packageID);
        const packageContent = packageContentBuffer.toString('utf-8');
        const jsonResponse = {
            metadata: {
                Name: packInfo[0].name,
                Version: packInfo[0].version,
                ID: packageID,
            },
            data: {
                Content: packageContent,
                JSProgram: packInfo[0].jsProgram || '',
            },
        };
        logger.info('Successfully retrieved package content and info');
        return res.status(200).send(jsonResponse);

    } catch (error) {
        logger.error("Bad Request:", error);
        return res.status(500).json({ error: 'Bad Request' });
    }
});

app.post('/package', async (req, res) => {
    const token = (req.headers['X-Authorization'] || req.headers['x-authorization']) as string;
    if(!token || token == '' || token == null || token.trim() == '') {
        logger.error('Missing Authentication Header');
        return res.status(403).send('Missing Authentication Header');
    }
    const {updatedToken, isAdmin, userGroup} = util.verifyToken(token);
    if(updatedToken instanceof Error) {
        logger.error('Invalid or expired token');
        return res.status(403).send(`Invalid or expired token: ${updatedToken}`);
    }
    if(isAdmin != true) {
        logger.error('You do not have the correct permissions to upload to the database.');
        return res.status(403).send('You do not have the correct permissions to upload to the database.')
    }
    let { Name, Content, URL, debloat, secret, JSProgram } = req.body
    if ((Content && URL) || (!Content && !URL)) {
        logger.error('Either Content or URL must be set, but not both.');
        return res.status(400).json({
            error: "Either 'Content' or 'URL' must be set, but not both.",
        });
    }
    if (!Name && Content) {
        logger.error("'Name' is required with Content.");
        return res.status(400).json({ error: "'Name' is required with Content." });
    }

    if (Content) {
        console.log("Processing package from content.");
        logger.info('Processing package from content');
        try {
            // Decode the base64-encoded zip file
            const buffer = Buffer.from(Content, 'base64');
    
            // Load the zip file using adm-zip
            const zip = new AdmZip(buffer);
    
            // Find the package.json file within the zip entries
            let packageJsonEntry = null;
            let readMeContent = '';
            zip.getEntries().forEach(function(zipEntry) {
                if (zipEntry.entryName.endsWith('package.json')) {
                    packageJsonEntry = zipEntry;
                }
                for (const file of possibleReadmeFiles) {
                    if (zipEntry.entryName.endsWith(file)) {
                        readMeContent = zipEntry.getData().toString('utf8');
                    }
                }
            });
            
            if (!packageJsonEntry) {
                logger.error('package.json not found in the provided content.');
                return res.status(400).json({ error: "package.json not found in the provided content." });
            }
            logger.info('package.json found in the provided content');  
            // Read and parse the package.json file
            const packageJsonContent = packageJsonEntry.getData().toString('utf8');
            const packageJson = JSON.parse(packageJsonContent);
    
            // Extract the repository link and package name
            const repository = packageJson.repository;
            let repoUrl = '';
            if (typeof repository === 'string') {
                repoUrl = repository;
            } else if (repository && repository.url) {
                repoUrl = repository.url;
            }
            repoUrl = util.parseRepositoryUrl(repoUrl).toString();
            logger.debug('Repository URL:', repoUrl);
            const packageName = packageJson.name;
            logger.debug('Package Name:', packageName);
            // Log or use the extracted information as needed
            let base64Zip = '';
            const tempDir = path.join(__dirname, 'tmp', packageName + '-' + Date.now());
            fs.mkdirSync(tempDir, { recursive: true });
            if (debloat) {
                logger.info('Debloating package');
                // Extract files and perform tree shaking
                await util.extractFiles(zip, tempDir);
                await util.treeShakePackage(tempDir);

                // Create a new ZIP file with tree-shaken code
                const updatedZipBuffer = await util.createZipFromDir(tempDir);

                // Encode the zip buffer as Base64
                base64Zip = updatedZipBuffer.toString('base64');
            } else {
                // If debloat is false, just zip the original content
                const zipBuffer = zip.toBuffer();
                base64Zip = zipBuffer.toString('base64');
            }
            fs.rmSync(tempDir, { recursive: true, force: true });
            const pkg = await db.getPackagesByNameOrHash(packageName, Package);
            if(pkg[0] == true) {
                logger.debug(`Package ${packageName} already exists with score: ${pkg[1]["score"]}`);
                const version = pkg[1]["version"];
                const packageId = SHA256(packageName + version).toString();
                const jsonResponse = {
                    metadata: {
                        Name: packageName,
                        Version: version,
                        ID: packageId,
                        Token: updatedToken,
                    },
                    data: {
                        Content: base64Zip,
                        JSProgram: JSProgram || '',
                    },
                };
                return res.status(409).send("Package already exists");
            } else {
                logger.info('Package does not exist');
                let version = packageJson.version;
                if(version == null || version == "") {
                    version = '1.0.0';
                }
                const packageId = SHA256(packageName + version).toString();
                const jsonResponse = {
                    metadata: {
                        Name: packageName,
                        Version: version,
                        ID: packageId,
                        Token: updatedToken,
                    },
                    data: {
                        Content: base64Zip,
                        JSProgram: JSProgram || '',
                    },
                };
                if (repoUrl.toLowerCase().includes('github')  === false) {
                    const badScore = await util.noRating(repoUrl);
                    const result = await db.addNewPackage(packageName, URL, Package, packageId, badScore, version, -1, "Content", readMeContent, secret, userGroup);
                    if(result[0] == false) {
                        logger.error(`Error uploading package:`, packageName);
                        return res.status(500).send('Error uploading package');
                    }
                    try {
                        await s3.uploadContentToS3(base64Zip, packageId);
                    } catch (e) {
                        logger.error('Error uploading content to S3:', e);
                        const removed = await db.removePackageByNameOrHash(packageId, Package);
                        if (removed == false) {
                            logger.error('Error removing package from mongo');
                        } else logger.error('Package removed from mongo');
                        return res.status(500).send('Error uploading content to S3');
                    }
                    logger.info(`Non-Github URL package uploaded`);

                    return res.status(201).send(jsonResponse);  
                }
                
                const [package_rating, package_net] = await rate(repoUrl);
                if (package_net >= 0.5) {
                    const result = await db.addNewPackage(packageName, URL, Package, packageId, package_rating, version, package_net, "Content", readMeContent, secret, userGroup);
                    if(result[0] == false) {
                        logger.error(`Error uploading package:`, packageName);
                        return res.status(500).send('Error uploading package');
                    }
                    try {
                        await s3.uploadContentToS3(base64Zip, packageId);
                    } catch (e) {
                        logger.error('Error uploading content to S3:', e);
                        const removed = await db.removePackageByNameOrHash(packageId, Package);
                        if (removed == false) {
                            logger.error('Error removing package from mongo');
                        } else logger.error('Package removed from mongo');
                        return res.status(500).send('Error uploading content to S3');
                    }
                    logger.debug(`Package ${packageName} uploaded with score: ${package_rating}`);

                    return res.status(201).send(jsonResponse);  
                    
                } else {
                    const jsonResponse = {
                        metadata: {
                            Token: updatedToken,
                        },
                        data: {
                            packageRating: package_rating,
                        },
                    };
                    logger.debug(`Package ${packageName} rating too low: ${package_rating}`);
                    return res.status(424).send(jsonResponse);
                }
            }
        } catch (error) {
            logger.error('Error processing package content:', error);
            return res.status(500).json({ error: 'Failed to process package content.' });
        }
    } else if (URL) {
        // Handle the URL for the package
        logger.info('Processing package from URL');
        try {
            if (URL.includes('npmjs.com')) {
                URL = await util.processNPMUrl(URL);
            }
            logger.debug('Processing URL:', URL);
            const tempDir = path.join(__dirname, 'tmp', 'repo-' + Date.now());
            fs.mkdirSync(tempDir, { recursive: true });

            await git.clone({
                fs,
                http,
                dir: tempDir,
                url: URL,
                singleBranch: true,
                depth: 1,
            });

            const packageJsonPath = path.join(tempDir, 'package.json');
            
            if (!fs.existsSync(packageJsonPath)) {
                // Clean up the temporary directory
                fs.rmSync(tempDir, { recursive: true, force: true });
                return res.status(400).json({
                    error: 'package.json not found in the repository.',
                });
            }
            
            const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageJsonContent);
            const package_name = packageJson.name;
            
            const readmeContent = util.findAndReadReadme(possibleReadmeFiles, tempDir);
            if(readmeContent == '') {
                logger.error('No README file found');
                return res.status(400).send('No README file found');
            }   
            let base64Zip = '';
            if (debloat) {
                logger.info('Debloating package');
                // Extract files and perform tree shaking
                await util.extractFiles(tempDir, tempDir);
                await util.treeShakePackage(tempDir);

                // Create a new ZIP file with tree-shaken code
                const updatedZipBuffer = await util.createZipFromDir(tempDir);

                // Encode the zip buffer as Base64
                base64Zip = updatedZipBuffer.toString('base64');
            } else {
                // If debloat is false, just zip the original content
                const zip = new AdmZip();
                zip.addLocalFolder(tempDir);
                const zipBuffer = zip.toBuffer();
                base64Zip = zipBuffer.toString('base64');
            }

            // Log or use the extracted information as needed
            logger.debug('Package Name:', package_name);
            fs.rmSync(tempDir, { recursive: true, force: true });
            const pkg = await db.getPackagesByNameOrHash(package_name, Package);
            if (pkg[0] == true) { // if the package already exists, just return the score
                logger.debug(`Package ${package_name} already exists with score: ${pkg[1]["score"]}`);
                const version = pkg[1]["version"];
                const packageId = SHA256(package_name + version).toString();
                const jsonResponse = {
                    metadata: {
                        Name: package_name,
                        Version: version,
                        ID: packageId,
                        Token: updatedToken,
                    },
                    data: {
                        Content: base64Zip,
                        JSProgram: JSProgram || '',
                    },
                };
                return res.status(409).send(jsonResponse);
            } else {
                logger.info('Package does not exist');
                const [package_rating, package_net] = await rate(URL);
                logger.debug('Package Net:', package_net);
                logger.debug('Package Rating:', package_rating);
                let version = packageJson.version;
                if(version == null || version == "") {
                    version = '1.0.0';
                }
                const packageId = SHA256(package_name + version).toString();
                const jsonResponse = {
                    metadata: {
                        Name: package_name,
                        Version: version,
                        ID: packageId,
                        Token: updatedToken
                    },
                    data: {
                        Content: base64Zip,
                        URL: URL,
                        JSProgram: JSProgram || '',
                    },
                };
                if (package_net >= 0.5) {
                    const result = await db.addNewPackage(package_name, URL, Package, packageId, package_rating, version, package_net, "URL", readmeContent, secret, userGroup);
                    if (result[0] == false) {
                        logger.error(`Error uploading package:`, package_name);
                        return res.status(500).send('Error uploading package');
                    }
                    try {
                        await s3.uploadContentToS3(base64Zip, packageId);
                    } catch (e) {
                        logger.error('Error uploading content to S3:', e);
                        const removed = await db.removePackageByNameOrHash(packageId, Package);
                        if (removed == false) {
                            logger.error('Error removing package from mongo');
                        } else logger.error('Package removed from mongo');  
                        return res.status(500).send('Error uploading content to S3');
                    }
                    return res.status(201).send(jsonResponse);
                    
                } else {
                    const jsonResponse = {
                        metadata: {
                            Token: updatedToken,
                        },
                        data: {
                            packageRating: package_rating,
                        },
                    };
                    logger.debug(`Package ${package_name} rating too low: ${package_rating}`);
                    return res.status(424).send(jsonResponse);
                }
            }
        } catch (error) {
            logger.error(`Error uploading package:`, error);
            console.log(error);
            return res.status(500).send('Error uploading package');
        }
    }
    
});

app.post('/package/:id', async (req, res) => { 
    try {
        const authToken = (req.headers['X-Authorization'] || req.headers['x-authorization']) as string
        if(!authToken || authToken == '' || authToken == null || authToken.trim() == '') {
            logger.info('Authentication failed due to invalid or missing AuthenticationToken');
            return res.status(403).send('Authentication failed due to invalid or missing AuthenticationToken');
        } 
        const { updatedToken, isAdmin, userGroup } = util.verifyToken(authToken);
        if (updatedToken instanceof Error) {
            logger.info('Invalid or expired token');
            return res.status(403).send(`Invalid or expired token: ${updatedToken}`);
        }
        if(isAdmin != true) {
            logger.error('You do not have the correct permissions to upload to the database.');
            return res.status(403).send('You do not have the correct permissions to upload to the database.')
        }
        const { metadata, data } = req.body
        if ((!data['Content'] && !data['URL']) || (data['Content'] && data['URL'])) {
            logger.info('Either content and URL were set, or neither were set.');
            return res.status(400).json({
                error: "Either 'Content' or 'URL' must be set, but not both.",
            });
        }

        if(data['Content'] && !data['Name'] || !data['Content'] && data['Name']) {
            logger.info('Name or Content was not set.');
            return res.status(400).send('Name or Content was not set.');
        }
        

        // Validate the metadata fields
        if (!metadata['Name'] || !metadata['Version'] || !metadata['ID']) {
            logger.info('Name, Version, or ID was not set.');
            return res.status(400).send('Name, Version, or ID was not set.');
        }
        if (typeof(metadata['Name']) != 'string' || typeof(metadata['Version']) != 'string' || typeof(metadata['ID']) != 'string') {
            logger.info('Name, Version, or ID is not a string.');
            return res.status(400).send('Metadata is of incorrect type.');
        }

        // Validate the data fields assuming url and content are properly sent
        if (data['Name'] && metadata['Name'] != data['Name']) {
            logger.info('Name in metadata does not match name in data.');
            return res.status(400).send('Name in metadata does not match name in data.');
        }

        if (metadata['ID'] != req.params.id) {
            logger.info('ID in metadata does not match ID in URL.');
            return res.status(400).send('ID in metadata does not match ID in URL.');
        }
        const packageID = metadata['ID'];
        const secret = data['secret'];
        const packageName = metadata['Name'];
        const version = metadata['Version'];
        let debloat = data['debloat'] ? true : false;
        let isUrl = false;
        let content = null;
        let url = data['URL'];
        console.log('Updating package:', packageName);
        if (url) { // if you are given a URL, get the base64 encoded zipped content
            isUrl = true;
            try {
                // if the url is npm, change it to github url
                if (url.includes('npmjs.com')) {
                    console.log('before process url: ', url);
                    url = await util.processNPMUrl(url);
                    console.log('after process url: ', url);
                    if (url == null) { // if the github url could not be extracted
                        logger.info('Invalid URL');
                        console.log('Invalid URL');
                        return res.status(400).send('Invalid URL');
                    }
                }

                // Process the URL
                logger.info('Processing URL:', url);
                content = await util.processGithubURL(url, version);
                if (content == null) { // if the content could not be extracted, returns null
                    logger.info('Error processing package content from URL');
                    return res.status(500).send('Error processing package content from URL');
                } else if (content == '-1') {
                    logger.info('No such version exists (URL update)');
                    return res.status(404).send('No such version exists');
                }
            } catch(error) {
                logger.error('Error processing package content from URL:', error);
                return res.status(500).send('Error processing package content');
            }
        } else {
            content = data['Content'];
        }
        // now that you know you have the zipped file, decoode the content
        const buffer = Buffer.from(content, 'base64');

        // load the zip file
        const zip = new AdmZip(buffer);
        let packageJsonEntry = null;
        let readMeContent = '';

        // find the package.json file
        zip.getEntries().forEach(function(zipEntry) {
            if (zipEntry.entryName.endsWith('package.json')) {
                packageJsonEntry = zipEntry;
            }

            for (const file of possibleReadmeFiles) {
                if (zipEntry.entryName.endsWith(file)) {
                    readMeContent = zipEntry.getData().toString('utf8');
                }
            }
        });
        if (!readMeContent) logger.info('No README file found');

        if (!packageJsonEntry) {
            logger.info('package.json not found in the provided content.');
            return res.status(500).send('package.json not found in the provided content.');
        }

        // read and parse package.json
        const packageJsonContent = packageJsonEntry.getData().toString('utf8');
        const packageJson = JSON.parse(packageJsonContent);

        if (!url) {
            const repository = packageJson.repository;
            if (typeof repository === 'string') {
                url = repository;
            } else if (repository && repository.url) {
                url = repository.url;
            }
            url = util.parseRepositoryUrl(url).toString();
        }
        logger.info('Package Name:', packageName);
        logger.info('Repository URL:', url);
        console.log('Package Name:', packageName);
        console.log('Repository URL:', url);

        let package_rating;
        let package_net;
        if (url.toLowerCase().includes('github') === false) {
            package_rating = util.noRating(url);
            package_net = -1;
        } else {
            [package_rating, package_net] = await rate(url);
        }

        if (package_net < 0.5 && url.toLowerCase().includes('github') === false) {
            logger.info(`Package ${packageName} rating too low: ${package_rating}`);
            return res.status(424).send('Package rating too low');
        }
        // package is now ingestible 
        const pkgs = await db.getPackagesByNameOrHash(packageName, Package);
        if (pkgs[0] == false) {
            if (pkgs[1][0] == -1) {
                logger.info('Package not found');
                return res.status(404).send('Package not found'); // possible that there was an error fetching here
            } else {
                logger.info('Internal Error: Could not fetch packages');
                return res.status(500).send('Internal Error: Could not fetch packages');
            }
        } else if (Array.isArray(pkgs[1])) { // gets mad if you dont do this
            const pkg_list = pkgs[1];
            // ensure that content only updated by content, url only updated by url
            if ((isUrl && pkg_list[0].ingestionMethod == "Content") || (!isUrl && pkg_list[0].ingestionMethod == "URL")) {
                logger.info('Ingestion method does not match');
                return res.status(400).send('Ingestion method does not match');
            }

            if (pkg_list[0]["secret"]) {
                // if not in user group that initially uploaded, you can't update
                if (pkg_list[0]["userGroup"] != userGroup) {
                    logger.error("No access: Wrong user group");
                    return res.status(403).send("No access: Wrong user group");
                } else if (secret == false) {
                    logger.error("Cannot make secret package public");
                    return res.status(403).send("Cannot make secret package public");
                }
            } else {
                if (secret == true) {
                    logger.error("Cannot make public package secret");
                    return res.status(403).send("Cannot make public package secret");
                }
            }

            // extract the major, minor, and patch version from input package
            const [majorKey, minorKey, patchKey] = version.split('.');
            logger.info("Extracting major, minor, and patch version from input package");
            // create list of all packages that have major and minor versions
            const matches = pkg_list.filter(pkg=> {
                const [major, minor] = pkg.version.split('.');
                return majorKey == major && minorKey == minor;
            }).map(pkg => pkg.version); // will only store the version string rather than whole package
            logger.info("Number of matches found: ", matches.length);

            matches.sort((a, b) => {
                const patchA = parseInt(a.split('.')[2]);
                const patchB = parseInt(b.split('.')[2]);
                return patchB - patchA; // sort in descending order
            });

            const tempDir = path.join(__dirname, 'tmp', packageName + '-' + Date.now());
            let base64zip = '';
            try {
                logger.info('Processing package content');
                if (debloat && !isUrl) {
                    await util.extractFiles(zip, tempDir);
                    await util.treeShakePackage(tempDir);
                    const updatedZipBuffer = await util.createZipFromDir(tempDir);
                    base64zip = updatedZipBuffer.toString('base64');
                } else {
                    // zip up the original content
                    const zipBuffer = zip.toBuffer();
                    base64zip = zipBuffer.toString('base64');
                }
            } catch (error) {
                logger.error('Error processing package content:', error);
                return res.status(500).send('Error processing package content');
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true});
            }
            const newPackageID = SHA256(packageName + version).toString();
            if (matches.length == 0) {
                const result = await db.addNewPackage( // talk to adhvik. should be using update package or add new package?
                    packageName, url, Package, newPackageID, package_rating, version, package_net, 
                    isUrl ? "URL" : "Content", readMeContent, secret, userGroup);
                
                if (result[0] == false) {
                    return res.status(500).send('Error adding package to mongo');
                }

                try {
                    // use try-catch because this has no return value
                    await s3.uploadContentToS3(base64zip, newPackageID);
                } catch (error) {
                    logger.debug('Error uploading content to S3:', error);
                    const removed = await db.removePackageByNameOrHash(newPackageID, Package);
                    if (removed == false) {
                        logger.debug('Error removing package from mongo');
                    } else logger.debug('Package removed from mongo');
                    logger.debug('Package not uploaded to S3');
                    return res.status(500).send('Error uploading content to S3');
                }

                if (result[0] == true) {
                    logger.info(`Package ${packageName} updated with score ${package_rating}, version ${version}, and id ${newPackageID}`);
                    return res.status(200).send('Package has been updated');
                }  else {
                    logger.info('Error updating package');
                    return res.status(500).send('Error updating package');
                }

            } else if (isUrl) {
                if (matches.includes(version)) { // the version already exists
                    logger.info('Package with version ${version} already exists');
                    return res.status(409).send('Package with version ${version} already exists');
                } else {
                    const result = await db.addNewPackage(
                        packageName, url, Package, newPackageID, package_rating, version, package_net, 
                        "URL", readMeContent, secret, userGroup);

                    if (result[0] == false) {
                        logger.debug('Error adding package to mongo');
                        return res.status(500).send('Error adding package to mongo');
                    }

                    try {
                        // use try-catch because this has no return value
                        await s3.uploadContentToS3(base64zip, newPackageID);
                    } catch (error) {
                        logger.debug('Error uploading content to S3:', error);
                        const removed = await db.removePackageByNameOrHash(newPackageID, Package);
                        if (removed == false) {
                            logger.debug('Error removing package from mongo');
                        } else logger.debug('Package removed from mongo');
                        logger.debug('Package not uploaded to S3');
                        return res.status(500).send('Error uploading content to S3');
                    }
                    if (result[0] == true) {
                        logger.info(`Package ${packageName} updated with score ${package_rating}, version ${version}, and id ${newPackageID}`);
                        return res.status(200).send('Package has been updated');
                    }
                }
            } else {
                // uploaded via content
                const latestUploadedPatch = parseInt(matches[0].split('.')[2]);
                if (parseInt(patchKey) > latestUploadedPatch) {
                    const result = await db.addNewPackage(
                        packageName, url, Package, newPackageID, package_rating, version, package_net, 
                        "Content", readMeContent, secret, userGroup);

                    if (result[0] == false) {
                        logger.debug('Error adding package to mongo');
                        return res.status(500).send('Error adding package to mongo');
                    }

                    try {
                        // use try-catch because this has no return value
                        await s3.uploadContentToS3(base64zip, newPackageID);
                    } catch (error) {
                        logger.debug('Error uploading content to S3:', error);
                        const removed = await db.removePackageByNameOrHash(newPackageID, Package);
                        if (removed == false) {
                            logger.debug('Error removing package from mongo');
                        } else logger.debug('Package removed from mongo');
                        logger.debug('Package not uploaded to S3');
                        return res.status(500).send('Error uploading content to S3');
                    }

                    logger.info(`Package ${packageName} updated with score ${package_rating}, version ${version}, and id ${newPackageID}`);
                    return res.status(200).send('Package has been updated');
                } else if (parseInt(patchKey) == latestUploadedPatch) {
                    logger.info('Version already exists');
                    return res.status(409).send('Version already exists');
                } else {
                    logger.info('Patch version is not the latest');
                    return res.status(400).send('Patch version is not the latest');
                }
            }
        }
    }  catch (error) {
        logger.error(error);
        return res.status(500).json({ error: 'Bad Request' });
    }
});

app.put('/authenticate', async (req, res) => {
    try {
        const { User, Secret } = req.body;
        // Validate request structure
        if (
          !User ||
          typeof User.name !== 'string' ||
          typeof User.isAdmin !== 'boolean' ||
          !Secret ||
          typeof Secret.password !== 'string'
        ) {
          return res.status(400).send('Malformed AuthenticationRequest');
        }
    
        const { name, isAdmin} = User;
        const { password } = Secret;
    
        // Hash the provided password using SHA-256
        const hashedPassword = SHA256(password).toString()
        
        // Query the database for the user
        const [found, user] = await db.getUserByName(name, UserModel);
        if(!found) {
          return res.status(401).send('Invalid username');
        }
        if(user.userHash !== hashedPassword) {
          return res.status(401).send('Invalid password');
        }
        console.log(`User: ${User}`);
        console.log(`Secret: ${Secret}`);
        console.log(`Userhash: ${user.userHash}`);
        console.log(`Hashed Password: ${hashedPassword}`);
        console.log(`user: ${user}`);

        const authToken = util.generateToken(user.isAdmin, user["userGroup"]);
        console.log(`authToken: ${authToken}`);
        const bearerToken = `bearer ${authToken}`;
        console.log(`bearer token: ${bearerToken}`);
        return res.status(200).send(bearerToken);
      } catch (error) {
        console.error(`Hasbulla: ${error}`);
        console.log(`Hasbulla: ${error}`);
        return res.status(500).send('Bad Request');
      }
});


app.get('/package//cost', async (req, res) => {
    // Extract Authentication Token
    const authToken = (req.headers['x-authorization'] || req.headers['X-Authorization']) as string;
    const dependencyParam = req.query.dependency;
    const dependency = dependencyParam === 'true'; // Defaults to false

    let token;
    let isadmin;
    let usergroup;
    if(!authToken || authToken == '' || authToken == null || authToken.trim() == '') {
        logger.error('Missing Authentication Header');
        return res.status(403).send('Missing Authentication Header');
    }
    try {
        const { updatedToken, isAdmin, userGroup } = util.verifyToken(authToken);
        if(updatedToken instanceof Error) {
            logger.error('Invalid or expired token');
            return res.status(403).send(`Invalid or expired token.`);
        }
        token = updatedToken;
        isadmin = isAdmin;
        usergroup = userGroup;

    } catch (error) {
        logger.error('Invalid or expired token');
        return res.status(403).send(`Invalid or expired token.`);
    }
    return res.status(400).send('Missing or invalid Package ID');
});

app.get('/package/:id/cost', async (req, res) => {
    // Extract Authentication Token
    const authToken = (req.headers['x-authorization'] || req.headers['X-Authorization']) as string;
    const dependencyParam = req.query.dependency;
    const dependency = dependencyParam === 'true'; // Defaults to false

    let token;
    let isadmin;
    let usergroup;
    // Authentication Check
    if(!authToken || authToken == '' || authToken == null || authToken.trim() == '') {
        logger.error('Missing Authentication Header');
        return res.status(403).send('Missing Authentication Header');
    }
    try {
        const { updatedToken, isAdmin, userGroup } = util.verifyToken(authToken);
        if(updatedToken instanceof Error) {
            logger.error('Invalid or expired token');
            return res.status(403).send(`Invalid or expired token.`);
        }
        token = updatedToken;
        isadmin = isAdmin;
        usergroup = userGroup;

    } catch (error) {
        logger.error('Invalid or expired token');
        return res.status(403).send(`Invalid or expired token.`);
    }

    const packageId = req.params.id;
    // Validate Package ID
    if (!packageId || typeof packageId !== 'string') {
        logger.error('Missing or invalid Package ID');
        return res.status(400).send('Missing or invalid Package ID');
    }

    const [success, packageInfo] = await db.getPackagesByNameOrHash(packageId, Package);
    if(!success && packageInfo[0] == -1) {
        logger.error('Package does not exist');
        return res.status(404).send('Package does not exist');
    }
    if(!success) {
        logger.error('Error retrieving package info:', packageInfo);
        return res.status(500).send('Server error while retrieving package info.');
    }

    if(packageInfo[0]["secret"] && packageInfo[0]["userGroup"] != usergroup) {
        logger.error("No access: Wrong user group");
        return res.status(403).send("No access: Wrong user group");   
    }
    
    try {
        const buffer = await s3.requestContentFromS3(packageId);
        const base64Content = buffer.toString('utf8');

        const binaryContent = Buffer.from(base64Content, 'base64');

        const zip = new AdmZip(binaryContent);

        const packageJsonEntry = zip.getEntry('package.json');
        if (!packageJsonEntry) {
            logger.error(`package.json not found in package ${packageId}`);
            return res.status(404).send('package.json not found in the package.');
        }

        const packageJsonContent = packageJsonEntry.getData().toString('utf8');
        const packageJson: util.PackageJson = JSON.parse(packageJsonContent);

        const dependencies = packageJson.dependencies ? Object.keys(packageJson.dependencies) : [];

        const standaloneCost = await util.calculatePackageSize(packageId);
        const packageCost: { [key: string]: { standaloneCost?: number; totalCost: number } } = {
            [packageId]: {
                totalCost: standaloneCost,
            },
        };
        if (dependency && dependencies.length > 0) {
            for (const depId of dependencies) {
                try {
                    const depBuffer = await s3.requestContentFromS3(depId);
                    const depBase64Content = depBuffer.toString('utf8');

                    const depBinaryContent = Buffer.from(depBase64Content, 'base64');

                    const depZip = new AdmZip(depBinaryContent);

                    const depPackageJsonEntry = depZip.getEntry('package.json');
                    if (!depPackageJsonEntry) {
                        logger.error(`package.json not found in dependency package ${depId}`);
                        continue;
                    }

                    const depPackageJsonContent = depPackageJsonEntry.getData().toString('utf8');
                    const depPackageJson: util.PackageJson = JSON.parse(depPackageJsonContent);
                    const depStandaloneCost = await util.calculatePackageSize(depId);
                    packageCost[depId] = {
                        standaloneCost: depStandaloneCost,
                        totalCost: depStandaloneCost,
                    };
                    packageCost[packageId].totalCost += depStandaloneCost;
                } catch (depError) {
                    logger.error(`Error processing dependency ${depId}:`, depError);
                }
            }
        }
        return res.status(200).json(packageCost);
    } catch (error: any) {
        if (error.name === 'NoSuchKey' || error.message.includes('NotFound')) { // AWS S3 specific error for missing objects
            logger.error(`Package not found in S3: ${packageId}`);
            return res.status(404).send('Package not found in S3.');
        }
        logger.error('Error retrieving package cost:', error);
        return res.status(500).send('Server error while retrieving package cost.');
    }
});

app.post('/packages', async (req, res) => {
    const offset = req.query.offset as string | undefined;
    const packageQueries: Array<{ Name: string; Version?: string }> = req.body;

    // Validate request body
    if (!Array.isArray(packageQueries) || packageQueries.length === 0) {
        console.log(packageQueries);
        console.log(packageQueries.length);
        logger.error('Invalid request body: Expected a non-empty array of PackageQuery.');
        return res.status(400).send("There are missing field(s) in the PackageQuery or it is formed improperly, or is invalid.");
    }

    // Check if enumerating all packages
    const isEnumerateAll = packageQueries.length === 1 && packageQueries[0].Name === '*';

    if (isEnumerateAll) {
        try {
            const limit = 50;
            const [success, packagesOrError] = await db.getAllPackages(Package);
            if (!success) {
                logger.error('Error fetching all packages:', packagesOrError);
                return res.status(500).send('Internal Server Error');
            }

            const allPackages: any[] = packagesOrError as any[];
            const start = offset ? parseInt(offset, 10) : 0;
            const paginatedPackages = allPackages.slice(start, start + limit + 1);
            let nextOffset: string | null = null;
            if (paginatedPackages.length > limit) {
                nextOffset = (start + limit).toString();
                paginatedPackages.splice(limit, 1);
                res.setHeader('offset', nextOffset);
            }

            const formattedPackages = paginatedPackages.map(pkg => ({
                Name: pkg.name,
                Version: pkg.version,
                ID: pkg.packageId,
            }));

            return res.status(200).json(formattedPackages);
        } catch (error) {
            logger.error('Error fetching all packages:', error);
            return res.status(500).send('Internal Server Error');
        }
    } else {
        // Validate each PackageQuery
        const versionPatterns = ['^', '~', '-'];
        for (const query of packageQueries) {
            if (
                typeof query.Name !== 'string' ||
                (query.Version && typeof query.Version !== 'string') ||
                !query.Name.trim() ||
                (query.Version && !query.Version.trim())
            ) {
                logger.error('Invalid PackageQuery format.');
                return res.status(400).send("There are missing field(s) in the PackageQuery or it is formed improperly, or is invalid.");
            }
            
            // Ensure Version is not a combination of different possibilities
            if (query.Version) {
                const patternCount = versionPatterns.reduce((count, pattern) => {
                    return count + (query.Version.includes(pattern) ? 1 : 0);
                }, 0);

                const isExactVersion = /^[0-9]+\.[0-9]+\.[0-9]+$/.test(query.Version);
                if (!isExactVersion && patternCount > 1) {
                    logger.error('Version cannot be a combination of different possibilities.');
                    return res.status(400).send("The 'Version' cannot be a combination of the different possibilities.");
                }
            }
        }

        try {
            const limit = 50;
            let fetchedPackages: any[] = [];
            for (const query of packageQueries) {
                const [success, packagesOrError] = await db.getPackagesByNameOrHash(query.Name, Package);
                if (!success) {
                    logger.error('Error fetching packages by name:', packagesOrError);
                    return res.status(500).send('Internal Server Error');
                }
                const packages: any[] = packagesOrError as any[];
                fetchedPackages = fetchedPackages.concat(packages);
            }
            // Remove duplicates based on ID
            const uniquePackages = Array.from(new Map(fetchedPackages.map(pkg => [pkg.packageId, pkg])).values());
            // Implement pagination
            const start = offset ? parseInt(offset, 10) : 0;
            const paginatedPackages = uniquePackages.slice(start, start + limit + 1);

            if (paginatedPackages.length > limit) {
                const nextOffset = (start + limit).toString();
                paginatedPackages.splice(limit, 1);
                res.setHeader('offset', nextOffset);
            }

            if (paginatedPackages.length > limit) {
                return res.status(413).send('Too many packages returned.');
            }
            console.log(paginatedPackages);
            const formattedPackages = paginatedPackages.map(pkg => ({
                Name: pkg.name,
                Version: pkg.version,
                ID: pkg.packageId,
            }));

            return res.status(200).json(formattedPackages);
        } catch (error) {
            logger.error('Error fetching packages:', error);
            return res.status(500).send('Internal Server Error');
        }
    }
});

app.get('/tracks', async (req, res) => {
    const plannedTracks = ["Access control track"]; // Replace with actual logic to retrieve planned tracks
    return res.status(200).json({ plannedTracks });
});

/*------------------ Extra APIs not in spec ------------------*/

app.post('/create-account', async (req, res) => {
    const { username, password, isAdmin, userGroup } = req.body;

    // Validate request data
    if (!username || !password || typeof isAdmin !== 'boolean') {
        return res.status(400).json({ error: 'Invalid request data' });
    }

    // Hash the password using SHA-256
    const hashedPassword = SHA256(password).toString();

    try {
        const [success, result] = await db.addUser(username, hashedPassword, isAdmin, userGroup, UserModel);
        console.log(success);
        if (success) {
            return res.status(200).json({ message: 'User created successfully', user: result });
        } else {
            console.log(result);
            return res.status(500).json({ error: 'Failed to create user', details: result });
        }
    } catch (error) {
        console.error('Error in /create-account:', error);
        return res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/delete-account', async (req, res) => {
    const { username, usernameToDelete, isAdmin } = req.body;
    
    if (!usernameToDelete || typeof isAdmin !== 'boolean') {
        return res.status(400).json({ error: 'Invalid request data' });
    }

    if (!isAdmin && username !== usernameToDelete) {
        return res.status(403).json({ error: 'Invalid permissions - Not Admin' });
    }
    try {
        const [success, result] = await db.removeUserByName(usernameToDelete, UserModel);
        if (success) {
            return res.status(200).json({ message: 'User deleted successfully', user: result });
        } else {
            return res.status(500).json({ error: 'Failed to delete user', details: result });
        }
    } catch (error) {
        console.error('Error in /delete-account:', error);
        return res.status(500).json({ error: 'Server error' });
    }
});
