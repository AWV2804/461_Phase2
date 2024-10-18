import logger from './logging.js'
import git, { clone } from 'isomorphic-git';
import os from 'os';
import fs from 'fs';
import http from 'isomorphic-git/http/node/index.cjs';
import path from 'path';

//hi

const compatible_licenses: RegExp[] = [/MIT\s[Ll]icense/, /GNU Lesser General Public License v2.0/,
    /GNU Lesser General Public License v2.1/, /GNU Lesser General Public License v3.0/, /\bMIT\b/];


/**
 * Checks for the presence of a license in a given repository directory.
 * 
 * @param repoUrl - The URL of the repository to check.
 * @param tempDir - The temporary directory where the repository files are located.
 * @returns A promise that resolves to a boolean indicating whether a license was found.
 * 
 * The function performs the following steps:
 * 1. Validates that the `repoUrl` contains "github.com".
 * 2. Reads the files in the `tempDir`.
 * 3. Checks for specific files (`readme.markdown`, `license`, `readme.md`, `package.json`).
 * 4. If `package.json` is found, it parses the file to check for a `license` field.
 * 5. For other files, it reads the content and verifies if it contains a license.
 * 6. Logs the content of the files being checked.
 * 7. Returns `true` if a valid license is found, otherwise returns `false`.
 * 8. Catches and logs any errors that occur during processing.
 */
export async function temp_license(repoUrl: string, tempDir: string): Promise<boolean> {
  if (!repoUrl.toString().includes("github.com")) {
      console.error('Could not find GitHub URL from npm package: ', repoUrl);
      return false;
  }
  try {    
      const files = fs.readdirSync(tempDir);
     
      for (const file of files) {
          //console.log("file: ", file);
          if (file.toLowerCase() === "readme.markdown" || file.toLowerCase() === "license" || file.toLowerCase() === "readme.md" || file.toLowerCase() === "package.json") {
   
              if(file.toLowerCase() === "package.json"){
                const jsoncontent = await getFileContent(tempDir, file);
                const packagejson = JSON.parse(jsoncontent);
                const license = packagejson.license;
                if(license){
                  const has_lic = license_verifier(license.toString());
                  if(has_lic){
                    return has_lic;
                  }
                }}
              else{
                const content = await getFileContent(tempDir, file);
                logger.info(`Content of ${repoUrl}:`, content);
                const license = license_verifier(content);
                //console.log(`License found: ${license}`);
                if(license)
                  return license;
              }
            }
          }
          
      
      //console.log("License not found in the root directory");
      return false;
            

} catch (error) {
      console.error("Error during processing: ", error);
      return false;
  } 
      
  
}

/**
 * Asynchronously reads the content of a file from a specified directory.
 *
 * @param tempDir - The temporary directory where the file is located.
 * @param filepath - The relative path to the file within the temporary directory.
 * @returns A promise that resolves to the content of the file as a string, or `undefined` if an error occurs.
 *
 * @throws Will log an error message to the console if the file cannot be read.
 */
 async function getFileContent(tempDir, filepath) {
  try {
    // Construct the full path to the file
    const filePath = path.join(tempDir, filepath);
    //console.log("trying to read file");

    // Read the file content
    const data = await fs.promises.readFile(filePath, 'utf-8');
    
    // Return the content
    return data;
  } catch (error) {
    console.error(`Failed to read file content: ${error}`);
    return undefined;
  }

  }


/**
 * Verifies if the provided file contents match any of the compatible licenses.
 *
 * @param file_contents - The contents of the file to be checked against the compatible licenses.
 * @returns A promise that resolves to `true` if a compatible license is found, otherwise `false`.
 */
export async function license_verifier(file_contents: string) {
        for (let i=0; i<compatible_licenses.length; i++) {
            if (compatible_licenses[i].test(file_contents)) {
                return true;
            }
        }
        return false;
}