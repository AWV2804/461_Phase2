// utils.ts

import { URL, fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import AdmZip from 'adm-zip';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node/index.cjs';
import fs from 'fs';
import logger from './logging.js';
import axios from 'axios';
import * as s3 from './s3_utils.js';
import { useCallback } from 'react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Interface for Package JSON structure
export interface PackageJson {
    dependencies?: { [key: string]: string };
    [key: string]: any; // To accommodate other possible fields
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
            if (repository.startsWith('github:')) {
                const [owner, repo] = repository.replace('github:', '').split('/');
                return `https://github.com/${owner}/${repo}`;
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
export async function processGithubURL(url: string): Promise<string | null> {
    const tempDir = path.join(__dirname, 'tmp', 'repo-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });
     try {
        await git.clone({
            fs,
            http,
            dir: tempDir,
            url: url,
            singleBranch: true,
            depth: 1,
        })

        const zip = new AdmZip();
        zip.addLocalFolder(tempDir);
        return zip.toBuffer().toString('base64');
    } catch(error) {
        logger.error('Error processing package content from URL:', error);
    } finally {
        fs.rmSync(tempDir, { recursive: true });
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
        const response = await axios.get(url);
        const repo = response.data.repository;
        if (repo && repo.url) {
            // replace the git+ prefix and .git suffix
            const githubUrl = repo.url.replace(/^git\+/, '').replace(/\.git$/,'');
            logger.info('Properly extracted github url from npm: ', githubUrl);
            return githubUrl;
        }
        logger.info('No repository field found in package.json');
        return null;
    } catch (error) {
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
