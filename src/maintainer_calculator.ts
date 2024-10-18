import fs from 'fs';

/**
 * Calculates Maintainer score
 * 
 * @param contributors - Array of contributors
 * @param issues - Array of issues from the Github API
 * @param pullRequests - Array of PRs
 * @param commits - N/A (unused)
 * @returns - Maintainer score
 */
export function maintainer_net(contributors: any, issues: any, pullRequests: any, commits: any): number {
    let responseTime = calculateAverageResponseTime(issues, pullRequests);
    let issueClosureTime = calculateIssueClosureTime(issues);
    let openClosedRatio = calculateOpenClosedRatio(issues);
    let activeMaintainers = calculateActiveMaintainers(contributors);

    // console.log(`Response Time: ${responseTime}`);
    // console.log(`Issue Closure Time: ${issueClosureTime}`);
    // console.log(`Open/Closed Ratio: ${openClosedRatio}`);
    // console.log(`Active Maintainers: ${activeMaintainers}`);
    const responsiveMaintainerScore = (0.4 * responseTime) + (0.3 * issueClosureTime) + (0.2 * openClosedRatio) + (0.1 * activeMaintainers);
    // console.log(`Responsive Maintainer Score: ${responsiveMaintainerScore}`);
    return responsiveMaintainerScore;
}

/**
 * Caclulates average response time
 * @param issues - Array of issues
 * @param pullRequests - Array of PRs
 * @returns 1 if average response time is less than 4 days, 0 otherwise
 */
function calculateAverageResponseTime(issues: any[], pullRequests: any[]): number {
    // Calculate average response time from issues and pull requests
    //use "created_at" and "closed_at" fields from issues and pull requests
    let totalResponseTime = 0;
    let count = 0;

    // Helper function to calculate time difference in hours
    const getTimeDifferenceInHours = (startTime: string, endTime: string) => {
        const start = new Date(startTime).getTime();
        const end = new Date(endTime).getTime();
        return (end - start) / (1000 * 60 * 60); // Convert from milliseconds to hours
    };

    // Calculate response time for issues
    for (const issue of issues) {
        if (issue.created_at && issue.closed_at) {
            const responseTime = getTimeDifferenceInHours(issue.created_at, issue.closed_at);
            totalResponseTime += responseTime;
            count++;
        }
    }

    // Calculate response time for pull requests
    for (const pr of pullRequests) {
        if (pr.created_at && pr.closed_at) {
            const responseTime = getTimeDifferenceInHours(pr.created_at, pr.closed_at);
            totalResponseTime += responseTime;
            count++;
        }
    }

    // Return the average response time in hours, or 0 if there are no valid issues/PRs
    let avg = count > 0 ? totalResponseTime / count : 0;

    //if the avg time response time is greater than 4 days then it is not responsive
    if(avg < 96){
        return 1;
    } else {
        return 0;
    }
}

/**
 * Calculates time it takes to close an issue
 * @param issues - Array of issues
 * @returns 1 if the time to close is less than 2 weeks, otherwise 0
 */
function calculateIssueClosureTime(issues: any[]): number {
    let totalClosureTime = 0;
    let count = 0;

    // Helper function to calculate time difference in hours
    const getTimeDifferenceInHours = (startTime: string, endTime: string) => {
        const start = new Date(startTime).getTime();
        const end = new Date(endTime).getTime();
        return (end - start) / (1000 * 60 * 60); // Convert from milliseconds to hours
    };

    // Loop through issues to calculate closure time
    for (const issue of issues) {
        if (issue.created_at && issue.closed_at) {
            const closureTime = getTimeDifferenceInHours(issue.created_at, issue.closed_at);
            totalClosureTime += closureTime;
            count++;
        }
    }

    // Return the average closure time in hours, or 0 if no valid issues
    let closetime = count > 0 ? totalClosureTime / count : 0;

    //if the close time is longer than 2 weeks then it is not responsive
    if(closetime < 336){
        return 1;
    } else {
        return 0;
    }
}

/**
 * Calculates the ratio of open to closed issues
 * @param issues - Array of issues
 * @returns 1 if ratio is less than 1, 0 else
 */
function calculateOpenClosedRatio(issues: any[]): number {
    // Count the number of open and closed issues
    let openCount = 0;
    let closedCount = 0;
    let totalcount = 0;
    for (const issue of issues) {
        if (issue.state === 'open') {
            openCount++;
            totalcount++;
        } else if (issue.state === 'closed') {
            closedCount++;  
            totalcount++;
        }
    }

    //if all issues are closed return 1
    if(totalcount == closedCount){
        return 1;
    }
    //if there are no issues return 1
    if(totalcount == 0){
        return 1;
    }
    //if all issues are open return 0
    if(totalcount == openCount){
        return 0;
    }

        
    // Calculate and return the ratio
    let ratio = openCount / closedCount;

    //if there are more open issues than closed issues then it is not responsive
    if(ratio < 1){
        return 1;
    } else {
        return 0;
    }

}

/**
 * Determines the number of active maintainers
 * @param contributors - Array of contributors
 * @returns If there are active maintainers (if more than 3, then return 1, otherwise 0)
 */
function calculateActiveMaintainers(contributors: any []): number {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // Count the number of unique active maintainers
    let activeMaintainersCount = 0;
    const activeMaintainers = new Set();
    for (const contributor of contributors) {
        //get the author of the commit
        const author = contributor.commit.author.name;
        //if the author is not already in the set of active maintainers
        if (!activeMaintainers.has(author)) {
            activeMaintainers.add(author);
            activeMaintainersCount++;
        }
    }

    //if there are more than 3 active maintainers then it is responsive
    if(activeMaintainersCount > 3){
        return 1;
    } else {
        return 0;
    }
}


