// utils.ts
import { URL, fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import AdmZip from 'adm-zip';
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/node/index.cjs';
import fs from 'fs';
import logger from './logging.js';
import axios from 'axios';
import * as s3 from './s3_utils.js';
import { useCallback } from 'react';
import jwt from 'jsonwebtoken';
import esbuild from 'esbuild';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();
const SECRET_KEY = process.env.SECRET_KEY
// Interface for Package JSON structure
export interface PackageJson {
    dependencies?: { [key: string]: string };
    [key: string]: any; // To accommodate other possible fields
}

interface CustomPayload {
    usageCount: number;
    exp: number;
    isAdmin: boolean;
    userGroup: string;
}

/**
 * Parses the `repository` field from a package.json and returns the HTTPS URL.
 * @param {string | object} repository - The repository field from package.json.
 * @returns {string | null} - The HTTPS URL of the repository or null if invalid.
 */
export function parseRepositoryUrl(repository: string | { url: string }): string | null {
    try {
        let url: URL;

        if (typeof repository === 'string') {
            // Handle shorthand format like "github:user/repo"
            if (/^[^/]+\/[^/]+$/.test(repository)) {
                return `https://github.com/${repository}`;
            }
            if (repository.startsWith('github:')) {
                const [owner, repo] = repository.replace('github:', '').split('/');
                return `https://github.com/${owner}/${repo}`;
            }
            if (repository.startsWith('git@')) {
                const sshParts = repository.split(':');
                if (sshParts.length === 2 && sshParts[1].includes('/')) {
                    const [host, path] = sshParts;
                    const repoPath = path.replace(/\.git$/, ''); // Remove trailing .git
                    return `https://${host.split('@')[1]}/${repoPath}`;
                }
            }
            if (/^[^/]+\/[^/]+$/.test(repository)) {
                return `https://github.com/${repository}`;
            }

            // Convert other formats to standard URL format
            url = new URL(repository.replace(/^git@/, 'https://').replace(/^git:\/\//, 'https://'));
        } else if (typeof repository === 'object' && repository.url) {
            // Handle repository object with type and url
            url = new URL(repository.url.replace(/^git@/, 'https://').replace(/^git:\/\//, 'https://'));
        } else {
            // Invalid repository format
            return null;
        }

        // Construct the HTTPS URL without the trailing '.git'
        const httpsUrl = `https://${url.host}${url.pathname.replace(/\.git$/, '')}`;
        return httpsUrl;
    } catch (error) {
        console.error('Invalid repository URL:', error);
        return null;
    }
}


/**
 * Clones a GitHub repository from the provided URL, compresses it into a ZIP file,
 * and returns the ZIP file as a base64-encoded string.
 *
 * @param url - The URL of the GitHub repository to clone.
 * @returns A promise that resolves to a base64-encoded string of the ZIP file, or null if an error occurs.
 *
 * @throws Will throw an error if the cloning or compression process fails.
 */
export async function processGithubURL(url: string, version: string): Promise<string | null> {
    const tempDir = path.join(__dirname, 'tmp', 'repo-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });
     try {
        console.log('before  fetch')
        await git.fetch({
            http,
            fs,
            url,
            dir: tempFetch,
            ref:  'refs/tags/*',
            depth: 1,
            singleBranch: false
        });
        console.log('after fetch')
        const tags = await git.listTags({ fs, dir: tempFetch });
        console.log('after list tags')

        if (!tags.includes(version)) {
            logger.error('Invalid version provided');
            return '-1';
        }
        console.log('after tags');
        await git.clone({
            fs,
            http,
            dir: tempDir,
            url: url,
            singleBranch: false,
            depth: 1,
        });

        const refs = await git.listTags({ fs, dir: tempDir });

        const patterns = [
            version,
            `v${version}`,
            `Version ${version}`,
            `version ${version}`,
        ];

        const matchedRef = refs.find((ref) => patterns.includes(ref));
        if (!matchedRef) {
            logger.error('Error: Version not found');
            console.debug('Error: Version not found');
            return '-1';
        }

        await git.checkout({
            fs,
            dir: tempDir,
            ref: matchedRef,
        });

        const zip = new AdmZip();
        console.log('before add local folder');
        zip.addLocalFolder(tempDir);
        console.log('after add local folder');
        logger.info('Base64 Encoded Zip Buffer: ', zip.toBuffer().toString('base64'));
        return zip.toBuffer().toString('base64');
    } catch(error) {
        logger.error('Error processing package content from URL:', error);
        console.error('Error processing package content from URL:', error);
        return null;
    } finally {
        fs.rmSync(tempDir, { recursive: true , force: true});
    }
}

/**
 * Processes the given NPM package URL to extract the GitHub repository URL.
 *
 * @param url - The URL of the NPM package to process.
 * @returns A promise that resolves to the GitHub repository URL as a string, or null if no repository field is found or an error occurs.
 *
 * @throws Will log an error message if the request to the URL fails or if the repository field is not found.
 */
export async function processNPMUrl(url: string): Promise<string | null> {
    try {
        const packageName = url.split('/').pop(); // Extract package name from URL
        const npmRegistryUrl = `https://registry.npmjs.org/${packageName}`;
        const response = await axios.get(npmRegistryUrl);
        console.log('response worked, url:' , url);
        const repo = response.data.repository;
        console.log('repo:', repo);
        if (repo && repo.url) {
            // replace the git+ prefix and .git suffix
            const githubUrl = repo.url.replace(/^git\+/, '').replace(/\.git$/,'');
            logger.info('Properly extracted github url from npm: ', githubUrl);
            console.log('github url:', githubUrl);
            return githubUrl;
        }
        console.log('No repository field found in package.json');
        logger.info('No repository field found in package.json');
        return null;
    } catch (error) {
        console.log('Error processing package content from URL:', error);
        logger.error('Error processing package content from URL:', error);
        return null;
    }
}


/**
 * Calculates the size of a package in megabytes (MB).
 * @param {string} hashKey - The hash key of the package in S3.
 * @returns {Promise<number>} - The size of the package in MB.
 */
export async function calculatePackageSize(hashKey: string): Promise<number> {
    try {
        // Retrieve the Base64-encoded content from S3
        const buffer = await s3.requestContentFromS3(hashKey);
        const base64Content = buffer.toString('utf8');

        // Decode the Base64 content to get binary data
        const binaryContent = Buffer.from(base64Content, 'base64');

        // Calculate the size in MB
        const sizeInMB = binaryContent.length / (1024 * 1024);

        return parseFloat(sizeInMB.toFixed(2)); // Rounded to 2 decimal places
    } catch (error) {
        logger.error(`Error calculating size for package ${hashKey}:`, error);
        throw new Error('Failed to calculate package size.');
    }
}

/**
 * Retrieves the dependencies for a given package by parsing its package.json from S3.
 * @param {string} hashKey - The hash key of the package in S3.
 * @returns {Promise<string[]>} - An array of dependency package IDs.
 */
export async function getPackageDependencies(hashKey: string): Promise<string[]> {
    try {
        // Retrieve the Base64-encoded content from S3
        const buffer = await s3.requestContentFromS3(hashKey);
        const base64Content = buffer.toString('utf8');

        // Decode the Base64 content to get binary data
        const binaryContent = Buffer.from(base64Content, 'base64');

        // Initialize AdmZip with the binary content
        const zip = new AdmZip(binaryContent);

        // Read the package.json file from the ZIP archive
        const packageJsonEntry = zip.getEntry('package.json');
        if (!packageJsonEntry) {
            logger.error(`package.json not found in package ${hashKey}`);
            throw new Error('package.json not found in the package.');
        }

        const packageJsonContent = packageJsonEntry.getData().toString('utf8');
        const packageJson: PackageJson = JSON.parse(packageJsonContent);

        // Extract dependencies from package.json
        const dependencies = packageJson.dependencies ? Object.keys(packageJson.dependencies) : [];

        return dependencies;
    } catch (error) {
        logger.error(`Error retrieving dependencies for package ${hashKey}:`, error);
        throw new Error('Failed to retrieve package dependencies.');
    }
}
export function findAndReadReadme(possibleReadmeFiles: string[], dirPath: string): String {
    for (const fileName of possibleReadmeFiles) {
        const filePath = path.join(dirPath, fileName);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return content;
        }
    }
    return '';
}

export function generateToken(isAdmin: boolean, userGroup: string): string {
    const payload: CustomPayload = {
        usageCount: 0,
        exp: Math.floor(Date.now() / 1000) + 10 * 60 * 60,
        isAdmin: isAdmin,
        userGroup: userGroup
    };
    return jwt.sign(payload, SECRET_KEY);
}

export function verifyToken(token: string): { updatedToken: string | Error; isAdmin: boolean | null; userGroup: string | null } {
    try {
        token = token.slice(7);
        logger.info('Token:', token);
        const payload = jwt.verify(token, SECRET_KEY) as CustomPayload;
        if(payload.usageCount >= 1000) {
            console.error('Token has expired');
            return { updatedToken: Error('Token has expired'), isAdmin: null, userGroup: null };
        }
        payload.usageCount++;
        
        const updatedToken = jwt.sign(payload, SECRET_KEY);

        return { updatedToken, isAdmin: payload.isAdmin, userGroup: payload.userGroup };
    } catch (error) {
        if(error instanceof jwt.TokenExpiredError) {
            console.error('Token has expired');
        } else {
            console.error('Invalid token');
        }
        return { updatedToken: error, isAdmin: null, userGroup: null };
    }
}

// Function to extract files from ZIP
export async function extractFiles(input: AdmZip | string, outputDir: string) {
    if (input instanceof AdmZip) {
        input.getEntries().forEach((zipEntry) => {
            const filePath = path.join(outputDir, zipEntry.entryName);
            if (!zipEntry.isDirectory) {
                zipEntry.extractTo(path.dirname(filePath), true);
            }
        });
    } else if (typeof input === 'string') {
        const files = fs.readdirSync(input);
        files.forEach((file) => {
            const filePath = path.join(input, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                const newDir = path.join(outputDir, file);
                fs.mkdirSync(newDir, { recursive: true });
                extractFiles(filePath, newDir);
            } else {
                const fileBuffer = fs.readFileSync(filePath);
                fs.writeFileSync(path.join(outputDir, file), fileBuffer);
            }
        });
    }
}

// Function to perform tree shaking with esbuild
export async function treeShakePackage(inputDir: string) {
    await esbuild.build({
        entryPoints: [inputDir], // Replace with correct entry file
        bundle: true,
        treeShaking: true,
        minify: true,
        outdir: inputDir,
        platform: 'node',
        target: 'esnext',
    });
}

// Function to create a ZIP file from a directory
export async function createZipFromDir(dir: string) {
    const zip = new AdmZip();
    zip.addLocalFolder(dir);
    return zip.toBuffer();
}