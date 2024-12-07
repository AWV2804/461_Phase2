import logger from './logging.js'

/**
 * Calculates the correctness score based on the ratio of closed issues to total issues.
 * 
 * @param issues - An array of all issues.
 * @param closedIssues - An array of closed issues.
 * @returns A promise that resolves to the correctness score, which is a number between 0 and 1.
 * 
 * The score is determined as follows:
 * - If there are no issues, the score is 1.
 * - If the ratio of closed issues to total issues is less than 0.1, the score is 0.
 * - If the ratio is between 0.1 and 0.4, the score is 0.4.
 * - If the ratio is between 0.4 and 0.7, the score is 0.7.
 * - If the ratio is 0.7 or higher, the score is 1.
 */
export async function calculateCorrectnessScore( issues: any[], closedIssues: any[]): Promise<number> {
    if (issues.length == 0) {
        logger.debug('Total issues count is zero, returning score as 1.');
        return 1;
    }
    logger.debug('total issues count:', issues.length);
    logger.debug('closed issues count:', closedIssues.length);
    const score = closedIssues.length / issues.length;
    logger.debug(`Calculated correctness score: ${score}`);
    if(score < 0.1) {
        return 0;
    } else if(score < 0.4) {
        return 0.4;
    } else if(score < 0.7) {
        return 0.7;
    } else {
        return 1;
    }
}
