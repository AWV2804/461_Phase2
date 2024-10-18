
import { metric_manager } from './metric_manager.js';
import {isGithubTokenValid} from './github_utils.js';
import { urlhandler } from './urlhandler.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import logger from './logging.js';
import {output_formatter} from './output_formatter.js';
import { cloneRepository } from './github_utils.js';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
//get the file path from the command line in run file
const filePath = process.argv[2];

if (!filePath) {
    console.error('Please provide a file path');
    process.exit(1);
}


// Read URLs from the file
fs.readFile(filePath, 'utf8', async (err, data) => {
    if (err) {
        console.error('Error reading URL file:', err);
        process.exit(1);
    }
    if( await isGithubTokenValid(process.env.GITHUB_TOKEN) === false){
        process.exit(1);}

    
    // Split the file content into individual URLs (assuming each URL is on a new line)
    const urls = data.split('\n').filter(Boolean); // Filter to remove any empty lines

    for (const url of urls) {
        try {
            // Call the urlHandler to process each URL
            //console.log(`Processing URL: ${url}`);
            logger.info(`Processing URL: ${url}`);
            logger.debug(`Processing URL: ${url}`); 
            const handler = new urlhandler(url); // Initialize handler with individual URL
           
            const data = await handler.handle(); // Call handler to process the URL
            const gitUrl = await handler.url;
            const contributors = await handler.contributors;
            const issues = await handler.issues;
            const pullRequests = await handler.pullRequests;
            const commits = await handler.commits;
            const closedIssues = await handler.closedIssues;

            // Clone the repository to a temporary directory
            //const tempDir= path.resolve(process.cwd(), 'repo');
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'temp-repo-'));
            await cloneRepository(gitUrl.toString(), tempDir);
            

            // Once the URL is processed, create and compute the metric
            const test_metric = new metric_manager(data, contributors, issues, pullRequests, commits, gitUrl, tempDir, closedIssues);
            const metric_array = await test_metric.parallel_metric_and_net_score_calc();

            // Delete the temporary directory
            try {
                if (fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                    //console.log(`Deleted existing directory: ${repoPath}`);
                }
            } catch (error) {
                console.error(`Error deleting directory: ${tempDir}`, error);
            }
  
            logger.info("Net Score, Net Latency: ", metric_array.reduce((a, b) => a + b, 0), test_metric.net_score_latency);
            output_formatter(url, metric_array, test_metric);

        } catch (error) {
            console.error(`Error processing URL ${url}:`, error);
        }
    }
});

