import express from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import * as util from './utils.js';
import * as db from './database';
import { rate } from './rate.js';
import cors from 'cors';
import logger from './logging.js';
import AdmZip from 'adm-zip';
import dotenv from 'dotenv';
import SHA256 from 'crypto-js/sha256';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs from 'fs';
import path from 'path';
import * as s3 from './s3_utils';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { verify } from 'crypto';
import esbuild from 'esbuild';

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

const packageDB = db.connectToMongoDB("Packages");
const userDB = db.connectToMongoDB("Users");

// console.log(packageDB);
const Package = packageDB[1].model('Package', db.packageSchema);
const UserModel = userDB[1].model('User', db.userSchema);
const app = express();
// app.use(express.json()); // parse incoming requests with JSON payloads
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));
dotenv.config();
// Frontend connnection setup
const FRONTEND_PORT = process.env.PORT || 3001;
app.use(cors({
    origin: `http://localhost:${FRONTEND_PORT}`, // Frontend's URL
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
                    url: `http://localhost:${BACKEND_PORT}`,
                },
                {
                    url: 'https://ec2-3-82-171-93.compute-1.amazonaws.com',
                }
            ]
        }
    },
    apis: ['./src/*.ts'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 *  /delete:
 *      delete:
 *          summary: Deletes the database
 *          responses:
 *              200:
 *                  description: Database deleted successfully
 *              500:
 *                  description: Error deleting database
 */
// TODO: HAVE TO ADD AUTHENTICATION PARSING
app.delete('/reset', async (req, res) => {
    const authToken = (req.headers['X-Authorization'] || req.headers['x-authorization']) as string;
    if(authToken == '' || authToken == null) {
        logger.error('Missing Authentication Header');
        res.status(403).send('Missing Authentication Header');
    }
    const {updatedToken, isAdmin, userGroup} = util.verifyToken(authToken);
    if(updatedToken instanceof Error) {
        logger.error('Invalid or expired token');
        return res.status(403).send(`Invalid or expired token: ${updatedToken}`);
    }
    if(isAdmin != true) {
        logger.error('You do not have the correct permissions to reset the registry.');
        return res.status(403).send('You do not have the correct permissions to reset the registry.')
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

/**
 * @swagger
 *  /upload/{url}:
 *     post:
 *      summary: Uploads a package and calculates the score
 *      parameters:
 *          - name: url
 *            in: path
 *            required: true
 *            schema:
 *              type: string
 *            description: The URL of the package to upload
 *      responses:
 *          200:
 *              description: Package uploaded successfully
 *              content:
 *                  text/plain:
 *                    schema:
 *                      type: number
 *                      description: The score of the package
 *          403:
 *              description: Package rating too low
 *          500:
 *              description: Error uploading package
 */
app.post('/package', async (req, res) => {
    // console.log(req.headers);
    const token = (req.headers['X-Authorization'] || req.headers['x-authorization']) as string;
    // console.log(token);
    if(token == '' || token == null) {
        logger.error('Missing Authentication Header');
        return res.status(403).send('Missing Authentication Header');
    }
    // console.log(token);
    const {updatedToken, isAdmin, userGroup} = util.verifyToken(token);
    if(updatedToken instanceof Error) {
        logger.error('Invalid or expired token');
        return res.status(403).send(`Invalid or expired token: ${updatedToken}`);
    }
    if(isAdmin != true) {
        logger.error('You do not have the correct permissions to upload to the database.');
        return res.status(403).send('You do not have the correct permissions to upload to the database.')
    }
    // if (token != monkeyBusiness) {
    //     logger.error('You do not have the correct permissions to upload to the database.');
    //     return res.status(403).send('You do not have the correct permissions to upload to the database.');
    // }
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
            // const AdmZip = require('adm-zip');
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
            // console.log('Package Name:', packageName);
            // console.log('Repository URL:', repoUrl);
            let base64Zip = '';
            const tempDir = path.join(__dirname, 'tmp', packageName + '-' + Date.now());
            // const distDir = path.join(tempDir, 'dist');
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
            // TODO: Rework the get into get all packages and then get the latest one
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
            // const zip = new AdmZip();
            // zip.addLocalFolder(tempDir);

            // // Get the zip content as a buffer
            // const zipBuffer = zip.toBuffer();

            // // Encode the zip buffer as Base64
            // const base64Zip = zipBuffer.toString('base64');

            // Log or use the extracted information as needed
            console.log('Package Name:', package_name);
            // fs.rmSync(distDir, { recursive: true });
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
    if(authToken == '' || authToken == null) {
        logger.error('Missing Authentication Header');
        return res.status(403).send('Missing Authentication Header');
    }
    const {updatedToken, isAdmin, userGroup} = util.verifyToken(authToken);
    if(updatedToken instanceof Error) {
        logger.error('Invalid or expired token');
        return res.status(403).send(`Invalid or expired token: ${updatedToken}`);
    }
    
    const packageId = req.params.id;
    if(packageId == '' || packageId == null) {
        logger.error('Missing package ID');
        return res.status(400).send('Missing package ID');
    }
    const pkg = await db.getPackagesByNameOrHash(packageId, Package);
    if(pkg[0] == false) {
        logger.error('Package not found');
        return res.status(404).send('Package not found');
    }
    if(pkg[1]["secret"] && pkg[1]["userGroup"] != userGroup) {
        logger.error("No access: Wrong user group");
        return res.status(403).send("No access: Wrong user group");
    }
    const scoreObject = JSON.parse(pkg[1]["score"]);
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
          return res.status(401).json({ error: 'Invalid password' });
        }
        const authToken = util.generateToken(isAdmin, user["userGroup"]);
        // console.log(user.isAdmin);
        return res.status(200).json({ authToken: `"${authToken}"` });
      } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Bad Request' });
      }
});


app.get('/package/:id', async (req, res) => {
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
        if (!packageID || typeof packageID !== 'string') {
            logger.info('There is missing field(s) in the PackageID or it is iformed improperly, or it is invalid.');
            return res.status(400).send('There is missing field(s) in the PackageID or it is iformed improperly, or it is invalid.');
        }
        const packageInfo = await db.getPackagesByNameOrHash(packageID, Package);
        if (!packageInfo[0]) {
            return res.status(404).send('Package not found: ' + packageInfo[1]);
        }
        if(packageInfo[1]["secret"] && packageInfo[1]["userGroup"] != userGroup) {
            logger.error("No access: Wrong user group");
            return res.status(403).send("No access: Wrong user group"); 
        }
        const packageContent = s3.requestContentFromS3(packageID);

        logger.info('Successfully retrieved package content and info');
        return res.status(200).json({ package: packageContent, info: packageInfo[1] });

    } catch (error) {
        logger.error(error);
        return res.status(400).json({ error: 'Bad Request' });
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
                    isUrl ? "URL" : "Content", readMeContent);
                
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
                        packageName, url, Package, newPackageID, package_rating, version, package_net, "URL", readMeContent);

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
                        packageName, url, Package, newPackageID, package_rating, version, package_net, "Content", readMeContent,);

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

app.post('/package/byRegEx', async (req, res) => {
    // Auth heaader stuff
    const authToken = (req.headers['X-Authorization'] || req.headers['x-authorization']) as string;
    const {updatedToken, isAdmin, userGroup} = util.verifyToken(authToken);
    if(updatedToken instanceof Error) {
        logger.error('Invalid or expired token');
        return res.status(403).send(`Invalid or expired token: ${updatedToken}`);
    }
    // if(isAdmin != true) {
    //     logger.error('You do not have the correct permissions to upload to the database.');
    //     return res.status(403).send('You do not have the correct permissions to upload to the database.')
    // }
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
    const accessiblePackages = packages.filter(pkg => {
        if (pkg["secret"] && pkg["userGroup"] != userGroup) {
            logger.error(`No access to package ${pkg["name"]}: Wrong user group`);
            return false; // Exclude this package
        }
        return true; // Include this package
    });
    const formattedPackages = accessiblePackages.map((pkg: any) => ({
        Version: pkg.version,
        Name: pkg.name,
        ID: pkg.packageId, // Use packageId if available, fallback to id
    }));
    return res.status(200).json(formattedPackages);
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
        const [success, result] = await db.addUser(username, hashedPassword, isAdmin, UserModel, userGroup);
        if (success) {
            return res.status(201).json({ message: 'User created successfully', user: result });
        } else {
            return res.status(500).json({ error: 'Failed to create user', details: result });
        }
    } catch (error) {
        console.error('Error in /create-account:', error);
        return res.status(500).json({ error: 'Server error' });
    }
});



