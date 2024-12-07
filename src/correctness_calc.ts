import logger from './logging.js'

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
