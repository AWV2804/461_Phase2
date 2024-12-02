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

// For TypeScript, you might need to cast to string
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const possibleReadmeFiles = [
    'README.md',
    'README',
    'README.txt',
    'README.rst',
    'README.markdown',
    'README.html',
];

const monkeyBusiness = '\"bearer 66abf860f10edcdd512e9f3f9fdc8af1bdc676503922312f8323f5090ef09a6a\"'

// const packageDB = db.connectToMongoDB("Packages");
// const userDB = db.connectToMongoDB("Users");
// const Package = packageDB[1].model('Package', db.packageSchema);
// const UserModel = userDB[1].model('User', db.userSchema);
export const app = express();
let packageDB;
let userDB;
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

// app.use(express.json()); // parse incoming requests with JSON payloads
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
//XXX:
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
                    url: `http://ec2-54-159-170-205.compute-1.amazonaws.com:8080/`, 
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
    if(authToken == '' || authToken == null || authToken.trim() == '') {
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
    try {
        const result = await db.deleteDB(packageDB[1]);
        const result2 = await db.deleteUsersExcept(UserModel);
        if (result[0] == true && result2[0] == true) {
            logger.info('Registry is reset.');
            return res.status(200).send('Registry is reset.');
        } else if(result[0] == false) {
            logger.error('Error deleting database:', result[1]);
            return res.status(500).send('Error deleting database');
        } else if(result2[0] == false) {
            logger.error('Error deleting user:', result2[1]);
            return res.status(500).send('Error deleting user');
        }
    } catch (error) {
        logger.error('Error deleting database:', error);
        res.status(500).send('Error deleting database');
    }
});

app.post('/package/byRegEx', async (req, res) => {
    // Auth heaader stuff
    const authToken = (req.headers['X-Authorization'] || req.headers['x-authorization']) as string;
    if(authToken == '' || authToken == null) {
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
    } catch (error) {
        logger.error('Error verifying token:', error);
        return res.status(403).send('Invalid or expired token');
    }
    const { RegEx } = req.body;
    if (!RegEx) {
        return res.status(400).json({ error: 'Malformed Request' });
    }
    const [success, packages] = await db.findPackageByRegEx(RegEx, Package);
    if (!success) {
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
    return res.status(200).json(formattedPackages);
});

app.get('/package//rate', async (req, res) => {
    const authToken = (req.headers['X-Authorization'] || req.headers['x-authorization']) as string;
    if(authToken == '' || authToken == null || authToken.trim() == '') {
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
/**
 * @swagger
 * /rate/{url}:
 *      post:
 *          summary: Rates a package
 *          parameters:
 *              - name: url
 *                in: path
 *                required: true
 *                schema:
 *                  type: string
 *                description: The URL of the package to rate
 *          responses:
 *              200:
 *                  description: Package rated successfully   
 *                  content:
 *                      text/plain:
 *                        schema:
 *                          type: number
 *                          description: The score of the package
 *              500:
 *                  description: Error rating package
 */
app.get('/package/:id/rate', async (req, res) => {
    const authToken = (req.headers['X-Authorization'] || req.headers['x-authorization']) as string;
    if(authToken == '' || authToken == null || authToken.trim() == '') {
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
        return res.status(404).send('Package not found: ' + packageInfo[1]);
    } else if(!packageInfo[0]) {
        return res.status(500).send(`Error retrieving package: ${packageInfo[1]}`);
    }
    const pkg = packageInfo[1] as any[];
    const scoreObject = JSON.parse(pkg[0]["score"]);
    const nullFields = Object.keys(scoreObject).filter(key => scoreObject[key] === null);
    if(nullFields.length > 0) {
        logger.error('Package rating choked');
        return res.status(500).send('Package rating choked');
    }
    const jsonResponse = {
        BusFactor: scoreObject["BusFactor"],
        BusFactorLatency: scoreObject["BusFactorLatency"],
        Correctnesss: scoreObject["Correctness"],
        CorrectnessLatency: scoreObject["Correctness_Latency"],
        RampUp: scoreObject["RampUp"],
        RampUpLatency: scoreObject["RampUp_Latency"],
        ResponsiveMaintainer: scoreObject["ResponsiveMaintainer"],
        ResponsiveMaintainerLatency: scoreObject["ResponsiveMaintainer_Latency"],
        LicenseScore: scoreObject["License"],
        LicenseScoreLatency: scoreObject["License_Latency"],
        GoodPinningPractice: scoreObject["GoodPinningPractice"],
        GoodPinningPracticeLatency: scoreObject["GoodPinningPractice_Latency"],
        PullRequest: scoreObject["PullRequest"],
        PullRequestLatency: scoreObject["PullRequest_Latency"],
        NetScore: scoreObject["NetScore"],
        NetScoreLatency: scoreObject["NetScore_Latency"],
    };
    return res.status(200).send(jsonResponse);
});

// app.get('/package/:id?', async (req, res) => {
//     try {
//         const token = req.headers['X-Authorization'] || req.headers['x-authorization']
//         if (token == '' || token == null) { 
//             logger.info('Authentication failed due to invalid or missing AuthenticationToken');
//             return res.status(403).send('Authentication failed due to invalid or missing AuthenticationToken');
//         } else if (token != monkeyBusiness) {
//             logger.info(`Authentication failed due to insufficient permissions`);
//             return res.status(403).send(`Authentication failed due to insufficient permissions`);
//         }
//         const packageID = req.params.id;
//         if (!packageID || typeof packageID !== 'string' || packageID.trim() === '') {
//             logger.info('There is missing field(s) in the PackageID or it is iformed improperly, or it is invalid.');
//             return res.status(400).send('There is missing field(s) in the PackageID or it is iformed improperly, or it is invalid.');
//         }
        
//         const packageInfo = await db.getPackagesByNameOrHash(packageID, Package);
//         if (!packageInfo[0] && packageInfo[1][0] == -1) {
//             return res.status(404).send('Package not found: ' + packageInfo[1]);
//         } else if(!packageInfo[0]) {
//             return res.status(500).send(`Error retrieving package: ${packageInfo[1]}`);
//         }
//         const packInfo = packageInfo[1] as any[];
//         const packageContentBuffer = await s3.requestContentFromS3(packageID);
//         const packageContent = packageContentBuffer.toString('base64');
//         logger.info('Successfully retrieved package content and info');
//         const jsonResponse = {
//             metadata: {
//               Name: packInfo[0].name,
//               Version: packInfo[0].version,
//               ID: packageID,
//             },
//             data: {
//               Content: packageContent,
//               JSProgram: packInfo[0].jsProgram || '',
//             },
//         };
//         return res.status(200).send(jsonResponse);

//     } catch (error) {
//         logger.error(error);
//         return res.status(500).json({ error: `Bad Request` });
//     }
// });

app.post('/package/:id?', async (req, res) => { // change return body? right now not returning the new package info
    try {
        const token = req.headers['X-Authorization'] || req.headers['x-authorization']
        if (token == '' || token == null) { 
            logger.info('Authentication failed due to invalid or missing AuthenticationToken');
            return res.status(403).send('Authentication failed due to invalid or missing AuthenticationToken');
        } else if (token != monkeyBusiness) {
            logger.info(`Authentication failed due to insufficient permissions`);
            return res.status(403).send(`Authentication failed due to insufficient permissions`);
        }
        
        const { metadata, data } = req.body
        if ((!data['Content'] && !data['URL']) || (data['Content'] && data['URL'])) {
            logger.info('Either content and URL were set, or neither were set.');
            return res.status(400).json({
                error: "Either 'Content' or 'URL' must be set, but not both.",
            });
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
        if (!data['Name'] || !data['debloat'] || !data['JSProgram']) {
            logger.info('Name, debloat, or JSProgram was not set.');
            return res.status(400).send('Name, debloat, or JSProgram was not set.');
        }
        if (typeof(data['Name']) != 'string' || typeof(data['debloat']) != 'boolean' || typeof(data['JSProgram']) != 'string') {
            logger.info('Name, debloat, or JSProgram is not a string.');
            return res.status(400).send('Data is of incorrect type.');
        }
        if (metadata['Name'] != data['Name']) {
            logger.info('Name in metadata does not match name in data.');
            return res.status(400).send('Name in metadata does not match name in data.');
        }

        if (metadata['ID'] != req.params.id) {
            logger.info('ID in metadata does not match ID in URL.');
            return res.status(400).send('ID in metadata does not match ID in URL.');
        }

        const packageID = metadata['ID'];
        const packageName = metadata['Name'];
        const version = metadata['Version'];
        const debloat = data['debloat'];
        let isUrl = false;
        let content = null;
        let url = data['URL'];

        if (url) { // if you are given a URL, get the base64 encoded zipped content
            isUrl = true;
            try {
                // if the url is npm, change it to github url
                if (url.includes('npmjs.com')) {
                    url = await util.processNPMUrl(url);
                    if (url == null) { // if the github url could not be extracted
                        logger.info('Invalid URL');
                        return res.status(400).send('Invalid URL');
                    }
                }

                // Process the URL
                content = await util.processGithubURL(url);
                if (content == null) { // if the content could not be extracted, returns null
                    logger.info('Error processing package content from URL');
                    return res.status(500).send('Error processing package content from URL');
                }
            } catch(error) {
                logger.error('Error processing package content from URL:', error);
                return res.status(500).send('Error processing package content');
            }
        } 
        // now that you know you have the zipped file, decoode the content
        const buffer = Buffer.from(content, 'base64');

        // load the zip file
        const zip = new AdmZip(buffer);
        let packageJsonEntry = null;

        // find the package.json file
        zip.getEntries().forEach(function(zipEntry) {
            if (zipEntry.entryName.endsWith('package.json')) {
                packageJsonEntry = zipEntry;
            }
        });

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

        const [package_rating, package_net] = await rate(url);

        if (package_net < 0.5) {
            logger.info(`Package ${packageName} rating too low: ${package_rating}`);
            return res.status(424).send('Package rating too low');
        }
        // package is now ingestible 
        let pkgs = await db.getPackagesByNameOrHash(packageName, Package);
        if (pkgs[0] == false) {
            if (pkgs[1][0] == -1) {
                logger.info('Package not found');
                return res.status(404).send('Package not found'); // possible that there was an error fetching here
            } else {
                logger.info('Internal Error: Could not fetch packages');
                return res.status(500).send('Internal Error: Could not fetch packages');
            }
        } else if (Array.isArray(pkgs[1])) { // gets mad if you dont do this
            // ensure that content only updated by content, url only updated by url
            if ((isUrl && pkgs[1][0].ingestionMethod == "Content") || (!isUrl && pkgs[1][0].ingestionMethod == "URL")) {
                logger.info('Ingestion method does not match');
                return res.status(400).send('Ingestion method does not match');
            }

            // extract the major, minor, and patch version from input package
            const [majorKey, minorKey, patchKey] = version.split('.');
            console.log(majorKey, minorKey, patchKey);
            logger.info("Extracting major, minor, and patch version from input package");
            // create list of all packages that have major and minor versions
            const matches = pkgs[1].filter(pkg=> {
                const [major, minor] = pkg.version.split('.');
                return majorKey == major && minorKey == minor;
            }).map(pkg => pkg.version); // will only store the version string rather than whole package
            logger.info("Number of matches found: ", matches.length);

            matches.sort((a, b) => {
                const patchA = parseInt(a.split('.')[2]);
                const patchB = parseInt(b.split('.')[2]);
                return patchB - patchA; // sort in descending order
            });

            //DEBLOATING STUFF GOES HERE

            const newPackageID = SHA256(packageName + version).toString();
            if (matches.length == 0) {
                await s3.uploadContentToS3(content, newPackageID);
                const result = await db.addNewPackage( // talk to adhvik. should be using update package or add new package?
                    packageName, url, Package, newPackageID, package_rating, version, package_net, 
                    isUrl ? "URL" : "Content");
                    
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
                    await s3.uploadContentToS3(content, newPackageID);
                    const result = await db.addNewPackage(
                        packageName, url, Package, newPackageID, package_rating, version, package_net, "URL");
                    if (result[0] == true) {
                        logger.info(`Package ${packageName} updated with score ${package_rating}, version ${version}, and id ${newPackageID}`);
                        return res.status(200).send('Package has been updated');
                    } else {
                        logger.info('Error updating package');
                        return res.status(500).send('Error updating package');
                    }
                }
            } else {
                // uploaded via content
                const latestUploadedPatch = parseInt(matches[0].split('.')[2]);
                if (parseInt(patchKey) > latestUploadedPatch) {
                    await s3.uploadContentToS3(content, newPackageID);
                    const result = await db.addNewPackage(
                        packageName, url, Package, newPackageID, package_rating, version, package_net, "Content");
                    if (result[0] == true) {
                        logger.info(`Package ${packageName} updated with score ${package_rating}, version ${version}, and id ${newPackageID}`);
                        return res.status(200).send('Package has been updated');
                    } else {
                        logger.info('Error updating package');
                        return res.status(500).send('Error updating package');
                    }
                } else {
                    logger.info('Patch version is not the latest');
                    return res.status(400).send('Patch version is not the latest');
                }
            }
        }
    }  catch (error) {
        console.log("Here");
        logger.error(error);
        return res.status(400).json({ error: 'Bad Request' });
    }
});

app.get('/package/:id?', async (req, res) => {
    try {
        const token = (req.headers['X-Authorization'] || req.headers['x-authorization']) as string
        if (token == '' || token == null) { 
            logger.info('Authentication failed due to invalid or missing AuthenticationToken');
            return res.status(403).send('Authentication failed due to invalid or missing AuthenticationToken');
        } 
        const { updatedToken, isAdmin, userGroup } = util.verifyToken(token);
        if (updatedToken instanceof Error) {
            logger.info('Invalid or expired token');
            return res.status(403).send(`Invalid or expired token: ${updatedToken}`);
        }

        const packageID = req.params.id;
        if (!packageID || typeof packageID !== 'string' || packageID.trim() === '') {
            logger.info('There is missing field(s) in the PackageID or it is iformed improperly, or it is invalid.');
            return res.status(400).send('There is missing field(s) in the PackageID or it is iformed improperly, or it is invalid.');
        }
        const packageInfo = await db.getPackagesByNameOrHash(packageID, Package);
        if (!packageInfo[0] && packageInfo[1][0] == -1) {
            return res.status(404).send('Package not found: ' + packageInfo[1]);
        } else if(!packageInfo[0]) {
            return res.status(500).send('Error fetching package: ' + packageInfo[1]);
        }
        if(packageInfo[1]["secret"] && packageInfo[1]["userGroup"] != userGroup) {
            logger.error("No access: Wrong user group");
            return res.status(403).send("No access: Wrong user group"); 
        }
        const packInfo = packageInfo[1] as any[];
        const packageContentBuffer = await s3.requestContentFromS3(packageID);
        const packageContent = packageContentBuffer.toString('base64');
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
        logger.error(error);
        return res.status(400).json({ error: 'Bad Request' });
    }
});

/**
 * @swagger
 * /package:
 *   post:
 *     summary: Uploads a package to the database
 *     description: Processes a package provided as a base64-encoded content or a URL and uploads it to the database.
 *     tags:
 *       - Packages
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - debloat
 *               - secret
 *             properties:
 *               Name:
 *                 type: string
 *                 description: The name of the package. Required if Content is provided.
 *               Content:
 *                 type: string
 *                 format: base64
 *                 description: Base64-encoded package content. Either Content or URL must be provided.
 *               URL:
 *                 type: string
 *                 format: uri
 *                 description: The URL pointing to the package repository. Either Content or URL must be provided.
 *               debloat:
 *                 type: boolean
 *                 description: Whether to perform tree shaking on the package.
 *               secret:
 *                 type: string
 *                 description: A secret for secure processing.
 *               JSProgram:
 *                 type: string
 *                 description: Additional JavaScript program data.
 *     responses:
 *       201:
 *         description: Package uploaded successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     Name:
 *                       type: string
 *                     Version:
 *                       type: string
 *                     ID:
 *                       type: string
 *                     Token:
 *                       type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     Content:
 *                       type: string
 *                     JSProgram:
 *                       type: string
 *       409:
 *         description: Package already exists.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     Name:
 *                       type: string
 *                     Version:
 *                       type: string
 *                     ID:
 *                       type: string
 *                     Token:
 *                       type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     Content:
 *                       type: string
 *                     JSProgram:
 *                       type: string
 *       400:
 *         description: Bad request. The input is invalid or incomplete.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       403:
 *         description: Missing or invalid authentication header.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       424:
 *         description: Package rating too low for upload.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     Token:
 *                       type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     packageRating:
 *                       type: number
 *       500:
 *         description: Server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
app.post('/package', async (req, res) => {
    const token = (req.headers['X-Authorization'] || req.headers['x-authorization']) as string;
    if(token == '' || token == null) {
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
        return res.status(400).json({
            error: "Either 'Content' or 'URL' must be set, but not both.",
        });
    }
    if (!Name && Content) {
        return res.status(400).json({ error: "'Name' is required with Content." });
    }

    // Process the uploaded package (dummy processing for this example)
    if (Content) {
        // Handle the base64-encoded content
        console.log("Processing package from content.");
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
                return res.status(400).json({ error: "package.json not found in the provided content." });
            }
    
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
            const packageName = packageJson.name;
    
            // Log or use the extracted information as needed
            let base64Zip = '';
            const tempDir = path.join(__dirname, 'tmp', packageName + '-' + Date.now());
            fs.mkdirSync(tempDir, { recursive: true });
            if (debloat) {
                
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
                logger.info(`Package ${packageName} already exists with score: ${pkg[1]["score"]}`);
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
                return res.status(409).send(jsonResponse);
            } else {
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
                    logger.info(`Package ${packageName} uploaded with score: ${package_rating}`);

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
                    logger.info(`Package ${packageName} rating too low: ${package_rating}`);
                    return res.status(424).send(jsonResponse);
                }
            }
        } catch (error) {
            console.error('Error processing package content:', error);
            return res.status(500).json({ error: 'Failed to process package content.' });
        }
    } else if (URL) {
        // Handle the URL for the package
        console.log("Processing package from URL.");
        try {
            if (URL.includes('npmjs.com')) {
                URL = await util.processNPMUrl(URL);
            }
            const tempDir = path.join(__dirname, 'tmp', 'repo-' + Date.now());
            // const distDir = path.join(tempDir, 'dist');
            fs.mkdirSync(tempDir, { recursive: true });
            // fs.mkdirSync(distDir, { recursive: true });

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
            console.log('Package Name:', package_name);
            fs.rmSync(tempDir, { recursive: true, force: true });
            const pkg = await db.getPackagesByNameOrHash(package_name, Package);
            if (pkg[0] == true) { // if the package already exists, just return the score
                logger.info(`Package ${package_name} already exists with score: ${pkg[1]["score"]}`);
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
                const [package_rating, package_net] = await rate(URL);
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
                console.log(package_net);
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
                    logger.info(`Package ${package_name} rating too low: ${package_rating}`);
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

// /**
//  * @swagger
//  * /package/{id}/rate:
//  *   get:
//  *     summary: Retrieve the rating details for a specific package
//  *     tags:
//  *       - Packages
//  *     security:
//  *       - BearerAuth: []
//  *     parameters:
//  *       - name: id
//  *         in: path
//  *         required: true
//  *         description: ID of the package to retrieve the rating for
//  *         schema:
//  *           type: string
//  *       - name: X-Authorization
//  *         in: header
//  *         required: true
//  *         description: Authentication token
//  *         schema:
//  *           type: string
//  *     responses:
//  *       200:
//  *         description: Successfully retrieved package rating
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 BusFactor:
//  *                   type: number
//  *                   description: Bus factor score
//  *                 BusFactorLatency:
//  *                   type: number
//  *                   description: Latency for calculating bus factor
//  *                 Correctnesss:
//  *                   type: number
//  *                   description: Correctness score
//  *                 CorrectnessLatency:
//  *                   type: number
//  *                   description: Latency for correctness calculation
//  *                 RampUp:
//  *                   type: number
//  *                   description: Ramp-up time score
//  *                 RampUpLatency:
//  *                   type: number
//  *                   description: Latency for ramp-up time calculation
//  *                 ResponsiveMaintainer:
//  *                   type: number
//  *                   description: Responsive maintainer score
//  *                 ResponsiveMaintainerLatency:
//  *                   type: number
//  *                   description: Latency for responsive maintainer calculation
//  *                 LicenseScore:
//  *                   type: number
//  *                   description: License score
//  *                 LicenseScoreLatency:
//  *                   type: number
//  *                   description: Latency for license score calculation
//  *                 GoodPinningPractice:
//  *                   type: number
//  *                   description: Good pinning practice score
//  *                 GoodPinningPracticeLatency:
//  *                   type: number
//  *                   description: Latency for good pinning practice calculation
//  *                 PullRequest:
//  *                   type: number
//  *                   description: Pull request score
//  *                 PullRequestLatency:
//  *                   type: number
//  *                   description: Latency for pull request score calculation
//  *                 NetScore:
//  *                   type: number
//  *                   description: Overall net score
//  *                 NetScoreLatency:
//  *                   type: number
//  *                   description: Latency for net score calculation
//  *       400:
//  *         description: Missing package ID
//  *       403:
//  *         description: Missing or invalid authentication, or wrong user group access
//  *       404:
//  *         description: Package not found
//  *       500:
//  *         description: Package rating calculation failed
//  */
// app.get('/package/:id/rate', async (req, res) => {
//     const authToken = (req.headers['X-Authorization'] || req.headers['x-authorization']) as string;
//     if(authToken == '' || authToken == null) {
//         logger.error('Missing Authentication Header');
//         return res.status(403).send('Missing Authentication Header');
//     }
//     const {updatedToken, isAdmin, userGroup} = util.verifyToken(authToken);
//     if(updatedToken instanceof Error) {
//         logger.error('Invalid or expired token');
//         return res.status(403).send(`Invalid or expired token: ${updatedToken}`);
//     }
    
//     const packageId = req.params.id;
//     if(packageId == '' || packageId == null) {
//         logger.error('Missing package ID');
//         return res.status(400).send('Missing package ID');
//     }
//     const pkg = await db.getPackagesByNameOrHash(packageId, Package);
//     if(pkg[0] == false) {
//         logger.error('Package not found');
//         return res.status(404).send('Package not found');
//     }
//     if(pkg[1]["secret"] && pkg[1]["userGroup"] != userGroup) {
//         logger.error("No access: Wrong user group");
//         return res.status(403).send("No access: Wrong user group");
//     }
//     const scoreObject = JSON.parse(pkg[1]["score"]);
//     const nullFields = Object.keys(scoreObject).filter(key => scoreObject[key] === null);
//     if(nullFields.length > 0) {
//         logger.error('Package rating choked');
//         return res.status(500).send('Package rating choked');
//     }
//     const jsonResponse = {
//         BusFactor: scoreObject["BusFactor"],
//         BusFactorLatency: scoreObject["BusFactorLatency"],
//         Correctnesss: scoreObject["Correctness"],
//         CorrectnessLatency: scoreObject["Correctness_Latency"],
//         RampUp: scoreObject["RampUp"],
//         RampUpLatency: scoreObject["RampUp_Latency"],
//         ResponsiveMaintainer: scoreObject["ResponsiveMaintainer"],
//         ResponsiveMaintainerLatency: scoreObject["ResponsiveMaintainer_Latency"],
//         LicenseScore: scoreObject["License"],
//         LicenseScoreLatency: scoreObject["License_Latency"],
//         GoodPinningPractice: scoreObject["GoodPinningPractice"],
//         GoodPinningPracticeLatency: scoreObject["GoodPinningPractice_Latency"],
//         PullRequest: scoreObject["PullRequest"],
//         PullRequestLatency: scoreObject["PullRequest_Latency"],
//         NetScore: scoreObject["NetScore"],
//         NetScoreLatency: scoreObject["NetScore_Latency"],
//     };
//     return res.status(200).send(jsonResponse);
// });

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
          return res.status(400).json({ error: 'Malformed AuthenticationRequest' });
        }
    
        const { name, isAdmin} = User;
        const { password } = Secret;
    
        // Hash the provided password using SHA-256
        const hashedPassword = SHA256(password).toString()
        
        // Query the database for the user
        const [found, user] = await db.getUserByName(name, UserModel);
        if(!found) {
          return res.status(401).json({ error: 'Invalid username' });
        }
        if(user.userHash !== hashedPassword) {
          return res.status(401).json({ error: 'Invalid password'});
        }
        const authToken = util.generateToken(user.isAdmin, user["userGroup"]);
        return res.status(200).json({ authToken: `"${authToken}"` });
      } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Bad Request' });
      }
});

app.post('/package/:id', async (req, res) => { // change return body? right now not returning the new package info
    try {
        const token = (req.headers['X-Authorization'] || req.headers['x-authorization']) as string
        if (token == '' || token == null) { 
            logger.info('Authentication failed due to invalid or missing AuthenticationToken');
            return res.status(403).send('Authentication failed due to invalid or missing AuthenticationToken');
        } 
        const { updatedToken, isAdmin, userGroup } = util.verifyToken(token);
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
        if (!data['Name'] || !data['debloat']) {
            logger.info('Name or debloat was not set.');
            return res.status(400).send('Name or debloat was not set.');
        }
        if (typeof(data['Name']) != 'string' || typeof(data['debloat']) != 'boolean' || typeof(data['JSProgram']) != 'string') {
            logger.info('Name, debloat, or JSProgram is not a string.');
            return res.status(400).send('Data is of incorrect type.');
        }
        if (metadata['Name'] != data['Name']) {
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
        const debloat = data['debloat'];
        let isUrl = false;
        let content = null;
        let url = data['URL'];

        if (url) { // if you are given a URL, get the base64 encoded zipped content
            isUrl = true;
            try {
                // if the url is npm, change it to github url
                if (url.includes('npmjs.com')) {
                    url = await util.processNPMUrl(url);
                    if (url == null) { // if the github url could not be extracted
                        logger.info('Invalid URL');
                        return res.status(400).send('Invalid URL');
                    }
                }

                // Process the URL
                content = await util.processGithubURL(url);
                if (content == null) { // if the content could not be extracted, returns null
                    logger.info('Error processing package content from URL');
                    return res.status(500).send('Error processing package content from URL');
                }
            } catch(error) {
                logger.error('Error processing package content from URL:', error);
                return res.status(500).send('Error processing package content');
            }
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

        const [package_rating, package_net] = await rate(url);

        if (package_net < 0.5) {
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
            console.log(majorKey, minorKey, patchKey);
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
            if (debloat) {
                await util.extractFiles(zip, tempDir);
                await util.treeShakePackage(tempDir);
                const updatedZipBuffer = await util.createZipFromDir(tempDir);
                base64zip = updatedZipBuffer.toString('base64');
            } else {
                // zip up the original content
                const zipBuffer = zip.toBuffer();
                base64zip = zipBuffer.toString('base64');
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
                        // use try-catch because this has to return value
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
                        // use try-catch because this has to return value
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

                    logger.info('Error updating package');
                    return res.status(500).send('Error updating package');
                } else {
                    logger.info('Patch version is not the latest');
                    return res.status(400).send('Patch version is not the latest');
                }
            }
        }
    }  catch (error) {
        logger.error(error);
        return res.status(400).json({ error: 'Bad Request' });
    }
});
// === New /package/:id/cost Endpoint ===

/**
 * @swagger
 * /package/{id}/cost:
 *   get:
 *     summary: Get the cost of a package
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier of the package (hashKey)
 *       - name: dependency
 *         in: query
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Whether to include dependencies in the cost calculation
 *       - name: X-Authorization
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *         description: The authentication token
 *     responses:
 *       200:
 *         description: Returns the cost of the package and its dependencies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: object
 *                 properties:
 *                   standaloneCost:
 *                     type: number
 *                     description: The stand-alone cost of this package excluding dependencies. Required if `dependency=true`.
 *                   totalCost:
 *                     type: number
 *                     description: >
 *                       The total cost of the package. If `dependency=false`, it's equal to `standaloneCost`.
 *                       If `dependency=true`, it's the sum of `standaloneCost` and all dependencies' costs.
 *               example: | 
 *                 "357898765": {
 *                   "standaloneCost": 50.0,
 *                   "totalCost": 95.0
 *                 },
 *                 "988645763": {
 *                   "standaloneCost": 20.0,
 *                   "totalCost": 45.0
 *                 }
 *       400:
 *         description: Missing or invalid Package ID
 *       403:
 *         description: Authentication failed due to invalid or missing AuthenticationToken.
 *       404:
 *         description: Package does not exist or package.json not found.
 *       500:
 *         description: Server-side errors during cost computation.
 */
app.get('/package/:id/cost', async (req, res) => {
    // Extract Authentication Token
    const authToken = (req.headers['x-authorization'] || req.headers['X-Authorization']) as string;
    const dependencyParam = req.query.dependency;
    const dependency = dependencyParam === 'true'; // Defaults to false

    // Authentication Check
    if (!authToken) {
        logger.error('Missing Authentication Header');
        return res.status(403).send('Missing Authentication Header');
    }
    const {updatedToken, isAdmin, userGroup} = util.verifyToken(authToken);
    if(updatedToken instanceof Error) {
        logger.error('Invalid or expired token');
        return res.status(403).send(`Invalid or expired token: ${updatedToken}`);
    }

    const packageId = req.params.id;
    const [success, packageInfo] = await db.getPackagesByNameOrHash(packageId, Package);
    if(!success && packageInfo[0] == -1) {
        logger.error('Package does not exist');
        return res.status(404).send('Package does not exist');
    }
    if(!success) {
        logger.error('Error retrieving package info:', packageInfo);
        return res.status(500).send('Server error while retrieving package info.');
    }

    if(packageInfo[0]["secret"] && packageInfo[0]["userGroup"] != userGroup) {
        logger.error("No access: Wrong user group");
        return res.status(403).send("No access: Wrong user group");   
    }
    // Validate Package ID
    if (!packageId || typeof packageId !== 'string') {
        logger.error('Missing or invalid Package ID');
        return res.status(400).send('Missing or invalid Package ID');
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

/**
 * @swagger
 * /packages:
 *   post:
 *     summary: Get packages from the registry based on query.
 *     parameters:
 *       - in: query
 *         name: offset
 *         schema:
 *           type: string
 *         description: Provide this for pagination. If not provided, returns the first page of results.
 *       - in: header
 *         name: X-Authorization
 *         required: true
 *         schema:
 *           type: string
 *         description: The authentication token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 Name:
 *                   type: string
 *                 Version:
 *                   type: string
 *               required:
 *                 - Name
 *                 - Version
 *           example:
 *             - Name: "React"
 *               Version: "^17.0.0"
 *     responses:
 *       200:
 *         description: List of packages
 *         content:
 *           application/json:
 *              schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   Name:
 *                     type: string
 *                   Version:
 *                     type: string
 *                   ID:
 *                     type: string
 *             example:
 *               - Name: "React"
 *                 Version: "17.0.2"
 *                 ID: "react"
 *       400:
 *         description: Missing or invalid fields in the PackageQuery.
 *       403:
 *         description: Authentication failed due to invalid or missing AuthenticationToken.
 *       413:
 *         description: Too many packages returned.
 */
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


/**
 * @swagger
 * /tracks:
 *   get:
 *     summary: Get the list of tracks a student has planned to implement in their code
 *     responses:
 *       200:
 *         description: Return the list of tracks the student plans to implement
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 plannedTracks:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Performance track"]
 *       500:
 *         description: The system encountered an error while retrieving the student's track information.
 */
app.get('/tracks', async (req, res) => {
    try {
        const plannedTracks = ["Access control track"]; // Replace with actual logic to retrieve planned tracks
        return res.status(200).json({ plannedTracks });
    } catch (error) {
        console.error('Error retrieving tracks:', error);
        return res.status(500).json({ error: 'The system encountered an error while retrieving the student\'s track information.' });
    }
});
/*------------------ Extra APIs not in spec ------------------*/

/**
 * @swagger
 * /create-account:
 *   post:
 *     summary: Create a new user account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               isAdmin:
 *                 type: boolean
 *             required:
 *               - username
 *               - password
 *               - isAdmin
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     username:
 *                       type: string
 *                     isAdmin:
 *                       type: boolean
 *                     userHash:
 *                       type: string
 *                     _id:
 *                       type: string
 *                     __v:
 *                       type: number
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /delete-account:
 *   delete:
 *     summary: Delete a user account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: The username of the requester
 *               usernameToDelete:
 *                 type: string
 *                 description: The username of the account to delete
 *               isAdmin:
 *                 type: boolean
 *                 description: Whether the requester is an admin
 *             required:
 *               - username
 *               - usernameToDelete
 *               - isAdmin
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   description: The deleted user object
 *       400:
 *         description: Invalid request data
 *       403:
 *         description: Invalid permissions - Not Admin
 *       500:
 *         description: Server error
 */
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