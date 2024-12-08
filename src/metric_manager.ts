import { Octokit } from "@octokit/rest";
import { gitAPIHandler } from "./gitAPIHandler.js";
import { maintainer_net } from "./maintainer_calculator.js";
import { temp_license } from "./template_for_license.js";
import { cloneRepository } from "./github_utils.js";
import { temp_bus_factor_calc } from "./new_bus_factor_calc.js";
import logger from './logging.js'
import fs from 'fs';
import path from "path";
import os from "os";
import { calculateRampUpScore } from './rampUp.js'; // Assuming rampUp contains ESLint logic
import { calculateCorrectnessScore } from "./correctness_calc.js";

/**
 * Rounding function
 * @param val Value to be rounded
 * @param num_decimal_places How many decimal places to round to
 * @returns Rounded number to specified decimal points
 */
function roundToNumDecimalPlaces(val: number, num_decimal_places: number) {
    return Math.round(val * Math.pow(10, num_decimal_places)) / Math.pow(10, num_decimal_places);
}

/**
 * Metric manager class
 */
export class metric_manager {
    public bus_factor_latency: number;
    public correctness_latency: number;
    public ramp_up_latency: number;
    public maintainer_latency: number;
    public license_latency: number;
    public net_score_latency: number;
    public metadata: any;
    public contributors: any;
    public issues: any;
    public pullRequests: any;
    public commits: any;
    public url: string;
    public data: any;
    public tempDir: string;
    public net_score: number;
    public closedIssues: any;
    public gitUrl: any;
    public dependency_pinning_latency: number;
    public pull_requests_code_metric_latency: number;

    /**
     * Creates metric_manager class
     * @param data URL data
     * @param contributors Array of contributors
     * @param issues Array of issues
     * @param pullRequests Array of PRs
     * @param commits Array of commits
     * @param url - Specific URL
     * @param tempDir - Temporary directory where URL Repo is cloned
     * @param closedIssues - Array of closed issues
     */
    constructor(
        data: any,
        contributors: any,
        issues: any,
        pullRequests: any,
        commits: any,
        url: string,
        tempDir: string,
        closedIssues: any
    ) {
        this.bus_factor_latency = 0;
        this.correctness_latency = 0;
        this.ramp_up_latency = 0;
        this.maintainer_latency = 0;
        this.license_latency = 0;
        this.net_score_latency = 0;
        this.metadata = data;
        this.contributors = contributors;
        this.issues = issues;
        this.closedIssues = closedIssues;
        this.pullRequests = pullRequests;
        this.commits = commits;
        this.url = url;
        this.data = data;
        this.tempDir = tempDir;
        this.dependency_pinning_latency = 0;
        this.pull_requests_code_metric_latency = 0;


    }
    /**
 * Calculates dependency pinning score
 * @returns Dependency pinning score
 */
    public dependency_pinning_calc(): number {
        const startTime = performance.now();
        logger.debug("Calculating dependency pinning score for GitHub repo: ", this.url);

        try {
            const packageJsonPath = path.join(this.tempDir, 'package.json');
            if (!fs.existsSync(packageJsonPath)) {
                logger.warn(`package.json not found in ${this.tempDir}. Assuming zero dependencies.`);
                this.dependency_pinning_latency = roundToNumDecimalPlaces(performance.now() - startTime, 3);
                return 1.0; // No dependencies, score is 1.0
            }

            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            const dependencies = packageJson.dependencies || {};
            const devDependencies = packageJson.devDependencies || {};

            const allDependencies = { ...dependencies, ...devDependencies };
            const totalDependencies = Object.keys(allDependencies).length;

            if (totalDependencies === 0) {
                this.dependency_pinning_latency = roundToNumDecimalPlaces(performance.now() - startTime, 3);
                return 1.0;
            }

            let pinnedCount = 0;

            const versionRegex = /^(\d+)\.(\d+)\.\d+$/; // Matches 'X.Y.Z'

            for (const [dep, version] of Object.entries(allDependencies)) {
                // Remove any leading characters like ^, ~, >=, etc.
                const cleanedVersion = (version as string).replace(/^[^\d]*/, '');

                const match = cleanedVersion.match(versionRegex);
                if (match) {
                    pinnedCount += 1;
                }
            }

            const score = pinnedCount / totalDependencies;
            this.dependency_pinning_latency = roundToNumDecimalPlaces(performance.now() - startTime, 3);
            return roundToNumDecimalPlaces(score, 3);
        } catch (error) {
            logger.error("Error calculating dependency pinning score:", error);
            this.dependency_pinning_latency = roundToNumDecimalPlaces(performance.now() - startTime, 3);
            return 0.0; // In case of error, default to 0.0
        }
    }
    
    // functions for calculating each metric
    //public bus_factor_calc(): Promise<number> {
    /**
     * Calculates busfactor score
     * @returns Busfactor score
     */
    public bus_factor_calc() {
        const startTime = performance.now();
        logger.debug("Calculating bus factor for github repo: ", this.url)
        let busfactor = temp_bus_factor_calc(this.url, this.commits);
        const endTime = performance.now();
        this.bus_factor_latency = roundToNumDecimalPlaces(endTime - startTime, 3);
        return busfactor
     
    
        
    }

    /**
     * Calculates correctness score
     * @returns Correctness score
     */
    public correctness_calc(): Promise<number> {
        const startTime = performance.now();
        logger.debug("Calculating correctness")
        logger.debug("Issues: ", this.issues)
        
        let correctness = calculateCorrectnessScore(this.issues, this.closedIssues);
        const endTime = performance.now();
        this.correctness_latency = roundToNumDecimalPlaces(endTime - startTime, 3);
        return correctness;
    }

    /**
     * Calculates ramp up score
     * @returns Ramp Up Score
     */
    public async calculateRampUpMetric(): Promise<number> {
        const startTime = Date.now();
        // Call the ramp-up score function, assuming repoData contains the necessary files
        //const rampUpScore = await calculateRampUpScore(this.data.files || []);
        const rampUpScore = await calculateRampUpScore(this.url,this.tempDir);
        const endTime = Date.now();
        this.ramp_up_latency = endTime - startTime;

        return rampUpScore; 
    }

    /**
     * Calculates maintainer score
     * @returns Maintainer score
     */
    public maintainer_calc(): number {
        const startTime = performance.now();
        logger.debug("Calculating maintainer factor")
        let maintainer_score = maintainer_net(this.contributors, this.issues, this.pullRequests, this.commits);
        const endTime = performance.now();
        this.maintainer_latency = roundToNumDecimalPlaces(endTime - startTime, 3);
        return maintainer_score;
    }

    /**
     * Calculates license score
     * @returns 1 for valid license, 0 else
     */
    public async licence_verify(): Promise<number> {
        const startTime = performance.now();
       
        // calculations for license verification
        logger.debug("Calculating license verification")
        let license_score = await temp_license(this.url, this.tempDir);
        const endTime = performance.now();
        this.license_latency = roundToNumDecimalPlaces(endTime - startTime, 3);
        return license_score === true ? 1 : 0;
    }


    /**
     * Calculates the code metric for pull requests.
     * 
     * This method filters the pull requests to find those that have been merged,
     * and then calculates the ratio of merged pull requests to the total number
     * of pull requests. The result is rounded to three decimal places.
     * 
     * @returns {number} The ratio of merged pull requests to total pull requests,
     * rounded to three decimal places. If there are no pull requests, returns 0.
     */
    calculatePullRequestCodeMetric(): number {
        const startTime = performance.now();
        const reviewedPullRequests = this.pullRequests.filter((pr: any) => pr.merged_at !== null);
        const totalPullRequests = this.pullRequests.length;
         if (totalPullRequests === 0) {
            logger.debug('Total pull requests count is zero, returning score as 0.');
            return 0;
        }
        const endTime = performance.now();
        this.pull_requests_code_metric_latency = roundToNumDecimalPlaces(endTime - startTime, 3);
        return roundToNumDecimalPlaces(reviewedPullRequests.length / totalPullRequests, 3);

    }

    /**
     * Calculates netscore and runs the metric calculations in parallel
     * @returns Array of metric scores
     */
    public async parallel_metric_and_net_score_calc() {
        const startTime = performance.now();
        const metric_array = await Promise.all([
            Promise.resolve(this.bus_factor_calc()),
            Promise.resolve(this.correctness_calc()),
            Promise.resolve(this.calculateRampUpMetric()),
            Promise.resolve(this.maintainer_calc()),
            Promise.resolve(this.licence_verify()),
            Promise.resolve(this.calculatePullRequestCodeMetric()),
            Promise.resolve(this.dependency_pinning_calc()) 
        ]);

        console.log(metric_array);

        // this.net_score = metric_array[4] * (.3*metric_array[3] + .1*metric_array[1] + .05*metric_array[0] + .3*metric_array[2] + .1*metric_array[5] + .15*metric_array[6]);
        this.net_score = metric_array[4] * (.05*metric_array[0] + .2*metric_array[1] + .4*metric_array[2] + .05*metric_array[3] + .1*metric_array[5] + .2*metric_array[6]);
        const endTime = performance.now();
        this.net_score_latency = roundToNumDecimalPlaces(endTime - startTime, 3);
        
        // Calculate pull_request_code metric
        const pullRequestCodeMetric = this.calculatePullRequestCodeMetric();
        metric_array.push(pullRequestCodeMetric);

        return metric_array;
    }

    
}
