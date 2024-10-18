import { Octokit } from "@octokit/rest";
import logger from './logging.js'
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Class to handle GitHub API requests
 */
export class gitAPIHandler{
  private octokit: any;  
  private owner: string;
  private repo: string;
  private url: URL
  public metadata: any;
  public validtoken: Promise<boolean>;
  

  /**
   * Constructor for the gitAPIHandler class
   * 
   * This class is used to handle GitHub API requests
   * 
   * @param url - URL of the GitHub repository
   */
  constructor(url: string){
    this.url = new URL(url)
    const tempURL = this.url.toString();
    [this.owner, this.repo] = tempURL.replace("https://github.com/", "").split("/");
    this.octokit = new Octokit({ 
        auth: process.env.GITHUB_TOKEN
      });
  }

  /**
   * This function uses the GitHub API to fetch details about the specified repository
   * 
   * @returns - Repository details
   */
  public async getRepoDetails() {       
    try {
        const response = await this.octokit.repos.get({
            owner: this.owner,
            repo: this.repo,
        });
        logger.info(`Successfully fetched repository details for ${this.owner}/${this.repo}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching repository details:", error);
    } 
  }

  /**
   * This function fetches the commit history for the specified repository
   * 
   * @returns - Commit history for the specified repository
   */
  public async getCommitHistory() {
    
    let commits = [];
    let page = 1;
    const perPage = 100; // Fetch the maximum number of commits per page
  
    try {
      while (page < 21) {
        const response = await this.octokit.request('GET /repos/{owner}/{repo}/commits', {
          owner: this.owner,
          repo: this.repo,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28'
          },
          per_page: perPage, // Number of commits per page
          page: page         // Current page number
        });
  
        // Add the current page's commits to the result array
        commits = commits.concat(response.data);
  
        // If the response has fewer commits than the requested number per page, we are done
        if (response.data.length < perPage) {
          break;
        }
  
        // Move to the next page
        page += 1;
      }
          return commits;
    } catch (error) {
      console.error(`Error fetching commits: ${error}`);
    }
  }


  /**
   *  This function fetches the README content for the specified repository
   * 
   * @returns - README content for the specified repository
   */
  public async get_readme(){
    try{
      const response = await this.octokit.rest.repos.getReadme ({
          owner:this.owner,
          repo:this.repo
      });

      // decoding the content since it is base64 encoded
      const readme_content = response.data.content;
      const decoded_readme_content = Buffer.from(readme_content, 'base64').toString('utf-8');
      logger.info(`Successfully fetched README for ${this.owner}/${this.repo}`);
      return decoded_readme_content;
    } catch(error){
        console.error("error fetching readme: ", error)
    }
  }
      
  /**
   * This function fetches all issues for the specified repository in the past 6 months
   * 
   * @returns - Issues for the specified repository in the past 6 months
   */
  public async getIssues() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const issues = await this.octokit.issues.listForRepo({
        owner: this.owner,
        repo: this.repo,
        since: sixMonthsAgo.toISOString(),
        state: 'all', // to get both open and closed issues
    });
    return issues.data;
  }
      
  /**
   * Retrieves a list of issues from the specified repository that were closed within the last six months.
   *
   * @returns {Promise<Array>} A promise that resolves to an array of issue objects.
   *
   * @remarks
   * This method uses the Octokit library to interact with the GitHub API and fetch issues.
   * It filters the issues to include only those that were closed within the last six months.
   */
  public async getClosedIssues() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const issues = await this.octokit.issues.listForRepo({
        owner: this.owner,
        repo: this.repo,
        since: sixMonthsAgo.toISOString(),
        state: 'closed', // to get both open and closed issues
    });
    return issues.data;
  }


  /**
   * This function fetches all pull requests for the specified repository in the past 6 months
   * 
   * @returns - Pull requests for the specified repository in the past 6 months
   */
  public async getPullRequests() {
      
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const pullRequests = await this.octokit.pulls.list({
            owner: this.owner,
            repo: this.repo,
            state: 'all', 
            per_page: 100,
        });
    return pullRequests.data;
  }
      

  /**
   * This function fetches all contributors for the specified repository in the past six months
   * 
   * @returns - Contributors for the specified repository
   */
  public async getContributors() {
    //get commits from the last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const commits = await this.octokit.repos.listCommits({
        owner: this.owner,
        repo: this.repo,
        since: ninetyDaysAgo.toISOString(),
      
      });

  //write contributers data to a file
    fs.writeFileSync('contributors.json', JSON.stringify(commits.data));
    return commits.data;
  }

  /**
   * This function fetches all files in the specified repository given a file path
   * 
   * @param path - The filepath to the directory
   * @returns - Files in the specified repository
   */
  public async fetchAllFiles(path:string){
    
    try {
      // Fetch content of the repository at the specified path
      const response = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        
        path: ''
      });
      let files: string[] = [];
      if (Array.isArray(response.data)) {
        for (const item of response.data) {
          if (item.type === 'file') {
            files.push(item.path);
          }
        }
      }
      else {
        files.push(response.data.path);
      } 
      logger.info('Successfully fetched files');
      return files
    
    } catch (error) {
      console.error('Error fetching files:', error);
      throw error;
    }
  }

  /**
   * This function fetches the content of a file in the specified repository
   * 
   * @param path - The path to the file
   * @returns - Content of the file
   */
  public async fetchFileContent(path: string) {
    try {
      const response = await this.octokit.repos.getContent({
        owner:this.owner,
        repo: this.repo,
        path: path,
      });

      // The file content is base64 encoded, so we need to decode it
      if (response.data.type === 'file' && response.data.encoding === 'base64') {
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        return content;
      } 
      else {
        console.error('Unable to read file content');
        throw new Error('Unable to read file content');
      }
    } catch (error) {
      console.error('Error fetching file content:', error);
      throw error;
    }
  }

  /**
   * This function fetches all files in the repository
   * 
   * @returns - Repository files
   */
  public async getRepositoryFiles(): Promise<string[]> {
  
    try {
      const allFiles = await this.fetchAllFiles('');
      const fileContents: string[] = [];

      for (const file of allFiles) {
        const content = await this.fetchFileContent(file);
        fileContents.push(content);
      }

      return fileContents;
    } catch (error) {
      console.error('Error fetching repository files for ramp-up analysis:', error);
      return [];
    }
  }
}