import { metric_manager } from './metric_manager.js';
import { urlhandler } from './urlhandler.js';
import * as fs from 'fs';
import {output_formatter} from './output_formatter.js';
import * as path from 'path';
import logger from './logging.js';
import { cloneRepository } from './github_utils.js';
import os from 'os';

/**
 * Processes a given URL to compute various metrics and returns a formatted output and net score.
 *
 * @param {string} url - The URL to be processed.
 * @returns {Promise<[string, number]>} A promise that resolves to a tuple containing the formatted output and net score.
 *
 * @throws Will throw an error if the URL processing fails.
 *
 * @example
 * ```typescript
 * const [formattedOutput, netScore] = await rate('https://example.com/repo');
 * console.log(formattedOutput, netScore);
 * ```
 */
export async function rate(url: string): Promise<[string, number]> {
    try {
        logger.info(`Processing URL: ${url}`);
        logger.debug(`Processing URL: ${url}`); 
        const handler = new urlhandler(url); // Initialize handler with individual URL
        
        const data = await handler.handle(); // Call handler to process the URL
        const gitUrl = await handler.url;
        const contributors = await handler.contributors;
        const issues = await handler.issues;
        const pullRequests = await handler.pullRequests;
        const closedIssues = await handler.closedIssues;
        const commits = await handler.commits;

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'temp-repo-'));
        await cloneRepository(gitUrl.toString(), tempDir);
        

        // Once the URL is processed, create and compute the metric
        const test_metric = new metric_manager(data, contributors, issues, pullRequests, commits, gitUrl.toString(), tempDir, closedIssues);
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
        return [output_formatter(url, metric_array, test_metric), test_metric.net_score];
    } catch (error) {
        console.error(`Error processing URL ${url}:`, error);
        return ["Error processing URL", 0];
    }
}