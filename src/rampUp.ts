import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { marked } from 'marked';
import TextStatistics from 'text-statistics';
import { gitAPIHandler } from './gitAPIHandler.js'; // For GitHub repos
import { npmHandler } from './npmHandler.js'; // For npm packages
import logger from './logging.js';

const execPromise = promisify(exec);

// Utility function to delete the directory if it exists
/**
 * Deletes the specified directory if it exists.
 *
 * @param repoPath - The path to the directory to be deleted.
 * @returns A promise that resolves when the directory has been deleted.
 *
 * @throws Will log an error message if the directory cannot be deleted.
 */
async function deleteDirectory(repoPath: string): Promise<void> {
    try {
        if (fs.existsSync(repoPath)) {
            fs.rmSync(repoPath, { recursive: true, force: true });
            //console.log(`Deleted existing directory: ${repoPath}`);
        }
    } catch (error) {
        console.error(`Error deleting directory: ${repoPath}`, error);
    }
}


function cleanText(text) {
    // all these tags should be preceeded by a full stop. 
    var fullStopTags = ['li', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'dd'];
    
    fullStopTags.forEach(function(tag) {
        text = text.replace("</" + tag + ">",".");
    });
    
    text = text
        .replace(/<[^>]+>/g, "")				// Strip tags
        .replace(/[,:;()\/&+]|\-\-/g, " ")				// Replace commas, hyphens etc (count them as spaces)
        .replace(/[\.!?]/g, ".")					// Unify terminators
        .replace(/^\s+/, "")						// Strip leading whitespace
        .replace(/[\.]?(\w+)[\.]?(\w+)@(\w+)[\.](\w+)[\.]?/g, "$1$2@$3$4")	// strip periods in email addresses (so they remain counted as one word)
        .replace(/[ ]*(\n|\r\n|\r)[ ]*/g, ".")	// Replace new lines with periods
        .replace(/([\.])[\.]+/g, ".")			// Check for duplicated terminators
        .replace(/[ ]*([\.])/g, ". ")				// Pad sentence terminators
        .replace(/\s+/g, " ")						// Remove multiple spaces
        .replace(/\s+$/, "");					// Strip trailing whitespace
        
    if(text.slice(-1) != '.') {
        text += "."; // Add final terminator, just in case it's missing.
    }
    return text;
}

function wordCount(text) {
    text = text ? cleanText(text) : text;
    return text.replace(/[^\.!?]/g, '').length || 1;
}

function sentenceCount(text) {
    text = text ? cleanText(text) : text;
    return text.split(/[\.!\?]+/).length || 1;
}

function averageWordsPerSentence(text) {
    text = text ? cleanText(text) : text;
    console.log(wordCount(text), sentenceCount(text));
    return wordCount(text) / sentenceCount(text);
}

function syllablesCount(word) {
    var syllableCount = 0,
			prefixSuffixCount = 0,
			wordPartCount = 0;
    word = word.toLowerCase().replace(/[^a-z]/g,"");
    var problemWords = {
        "simile":		3,
        "forever":		3,
        "shoreline":	2
    };
    if (problemWords.hasOwnProperty(word)) return problemWords[word];
		
		// These syllables would be counted as two but should be one
		var subSyllables = [
			/cial/,
			/tia/,
			/cius/,
			/cious/,
			/giu/,
			/ion/,
			/iou/,
			/sia$/,
			/[^aeiuoyt]{2,}ed$/,
			/.ely$/,
			/[cg]h?e[rsd]?$/,
			/rved?$/,
			/[aeiouy][dt]es?$/,
			/[aeiouy][^aeiouydt]e[rsd]?$/,
			/^[dr]e[aeiou][^aeiou]+$/, // Sorts out deal, deign etc
			/[aeiouy]rse$/ // Purse, hearse
		];
	
		// These syllables would be counted as one but should be two
		var addSyllables = [
			/ia/,
			/riet/,
			/dien/,
			/iu/,
			/io/,
			/ii/,
			/[aeiouym]bl$/,
			/[aeiou]{3}/,
			/^mc/,
			/ism$/,
			/([^aeiouy])\1l$/,
			/[^l]lien/,
			/^coa[dglx]./,
			/[^gq]ua[^auieo]/,
			/dnt$/,
			/uity$/,
			/ie(r|st)$/
		];
	
		// Single syllable prefixes and suffixes
		var prefixSuffix = [
			/^un/,
			/^fore/,
			/ly$/,
			/less$/,
			/ful$/,
			/ers?$/,
			/ings?$/
		];
	
		// Remove prefixes and suffixes and count how many were taken
		prefixSuffix.forEach(function(regex) {
			if (word.match(regex)) {
				word = word.replace(regex,"");
				prefixSuffixCount ++;
			}
		});
		
		wordPartCount = word
			.split(/[^aeiouy]+/ig)
			.filter(function(wordPart) {
				return !!wordPart.replace(/\s+/ig,"").length;
			})
			.length;
		
		// Get preliminary syllable count...
		syllableCount = wordPartCount + prefixSuffixCount;
		
		// Some syllables do not follow normal rules - check for them
		subSyllables.forEach(function(syllable) {
			if (word.match(syllable)) syllableCount --;
		});
		
		addSyllables.forEach(function(syllable) {
			if (word.match(syllable)) syllableCount ++;
		});
		
		return syllableCount || 1;
}
function averageSyllablesPerWord(text) {
    text = text ? cleanText(text) : text;
    var syllableCount = 0, wordsCount = wordCount(text);
    text.split(/\s+/).forEach(function(word) {
        syllableCount += syllablesCount(word);
    });
    console.log(syllableCount, wordsCount);
    return (syllableCount||1) / (wordsCount||1);
}
function fleschKincaidReadingEase(text) {
    text = text ? cleanText(text) : text;
    const avgWordsPerSentence = averageWordsPerSentence(text);
    const avgSyllablesPerWord = averageSyllablesPerWord(text);
    console.log(avgWordsPerSentence, avgSyllablesPerWord);
    return Math.round((206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord))*10)/10;
}
// Calculate readability of the text using text-statistics
/**
 * Calculates the readability of the given text content.
 *
 * @param textContent - The text content to analyze for readability.
 * @returns An object containing the readability ease score and grade level.
 * @property ease - The Flesch-Kincaid Reading Ease score.
 * @property gradeLevel - The Flesch-Kincaid Grade Level.
 */
function calculateReadability(textContent: string): { ease: number } {
    // const stats = new TextStatistics(textContent); // Create an instance of TextStatistics
    // const ease = stats.fleschKincaidReadingEase();
    // const gradeLevel = stats.fleschKincaidGradeLevel();
    // console.log(`Test Score: ${fleschKincaidReadingEase(textContent)}`);
    return {
        ease: fleschKincaidReadingEase(textContent)
    };
}

// Check Documentation Quality of README.md in the repository
/**
 * Checks the quality of the documentation in a given repository by analyzing the README.md file.
 * 
 * @param repoPath - The file path to the repository.
 * @returns A promise that resolves to a number representing the documentation quality score.
 *          The score is based on the readability of the README.md file.
 *          Returns 0 if the README.md file is not found or an error occurs.
 * 
 * @throws Will log an error message if the README.md file is not found or if an error occurs during the process.
 */
async function checkDocumentationQuality(repoPath: string): Promise<number> {
    try {
        const readmePath = path.join(repoPath.toString(), 'README.md');
        //console.log('README Path:', readmePath);
        if (!fs.existsSync(readmePath)) {
            logger.error('README.md not found.');
            return 0;
        }
        logger.debug(`README Path: ${readmePath}`);
        const readmeContent = fs.readFileSync(readmePath, 'utf8');
        console.log('README.md content:', readmeContent.substring(0, 200));
        const plainTextContent = await marked.parse(readmeContent); // Convert Markdown to plain text for analysis
        console.log('Plain Text Content:', plainTextContent.substring(0, 200));
        const readabilityScores = calculateReadability(plainTextContent);
        logger.debug(`Readability Scores - Ease: ${readabilityScores.ease}`);
        //console.log(`Readability Scores - Ease: ${readabilityScores.ease}, Grade Level: ${readabilityScores.gradeLevel}`);
        //console.log('README.md content:', plainTextContent.substring(0, 200));

        const totalScore = readabilityScores.ease / 100;
        //console.log(`Documentation quality checked successfully with readability assessment.`);
        return totalScore < 0 ? totalScore*-1 : totalScore;

    } catch (error) {
        console.error('Error checking documentation quality:', error);
        return 0;
    }
}

/**
 * Checks if a given URL is a GitHub URL.
 *
 * @param url - The URL to check.
 * @returns `true` if the URL contains 'github.com', otherwise `false`.
 */
function isGithubUrl(url: string): boolean {
    return url.includes('github.com');
}

/**
 * Checks if a given URL is an npm URL.
 *
 * @param url - The URL to check.
 * @returns `true` if the URL contains 'npmjs.com', otherwise `false`.
 */
function isNpmUrl(url: string): boolean {
    return url.includes('npmjs.com');
}

/**
 * Calculates the ramp-up score for a given repository or package URL.
 * 
 * @param url - The URL of the repository or package. Can be a string or a URL object.
 * @param repoPath - The local path where the repository will be cloned for analysis.
 * @returns A promise that resolves to a number representing the ramp-up score, ranging from 0 to 1.
 * 
 * The function handles both GitHub and npm URLs. For GitHub URLs, it clones the repository and checks the documentation quality.
 * For npm URLs, it retrieves the package metadata and checks for an associated GitHub repository. If found, it clones and analyzes
 * the repository; otherwise, it bases the score on npm metadata such as maintainers.
 * 
 * If an unsupported URL type is provided, the function logs an error and returns a score of 0.
 * In case of any errors during the process, the function catches the error, logs it, and returns a score of 0.
 */
export async function calculateRampUpScore(url: string | URL, repoPath): Promise<number> {
    //const repoPath = path.resolve(process.cwd(), 'repo'); // The repo will be cloned in the current directory

    try {
        // Clean up the repo directory first
        //await deleteDirectory(repoPath);

        // Convert the URL object to a string if necessary
        const urlString = typeof url === 'string' ? url : url.toString();

        //console.log(`Validating URL: ${urlString}`);

        let rampUpScore = 0;

        // Handle GitHub URLs
        if (isGithubUrl(urlString)) {
            //console.log('Processing GitHub repository...');
            //const gitHandler = new gitAPIHandler(urlString);
            //await gitHandler.cloneRepository(repoPath);
            //console.log("Repository cloned successfully.");

            // Check documentation quality
            rampUpScore = await checkDocumentationQuality(repoPath);
            logger.debug(`Ramp-Up Score (GitHub): ${rampUpScore}`);
            //console.log(`Ramp-Up Score (GitHub): ${rampUpScore}`);

        // Handle npm URLs
        } else if (isNpmUrl(urlString)) {
            //console.log('Processing NPM package...');
            const packageName = urlString.split('/').pop(); // Get package name from URL
            const npmMetadata = await npmHandler.processPackage(packageName || '');

            //console.log('NPM Metadata:', npmMetadata);

            // If there's a GitHub repository URL in the npm metadata, clone and analyze
            if (npmMetadata.gitUrl && isGithubUrl(npmMetadata.gitUrl)) {
                //console.log('GitHub repository found in NPM metadata, processing GitHub repo...');
                // const gitHandler = new gitAPIHandler(npmMetadata.gitUrl);
                // await gitHandler.cloneRepository(repoPath);
                rampUpScore = await checkDocumentationQuality(repoPath);
                
            } else {
                // If no GitHub repo is available, base the score on npm metadata (e.g., maintainers, license)
                //console.log('No GitHub repository found, scoring based on npm metadata...');
                rampUpScore = npmMetadata.maintainers.length / 10; // Example score based on maintainers
            }
            logger.debug(`Ramp-Up Score (NPM): ${rampUpScore}`);
            //console.log(`Ramp-Up Score (NPM): ${rampUpScore}`);
        } else {
            console.error('Unsupported URL type. Please provide a GitHub or npm URL.');
            return 0;
        }

        while(rampUpScore > 1) {
            rampUpScore = rampUpScore / 10;
        }

        // Clean up after analysis
        //await deleteDirectory(repoPath);
        //console.log(`Repository directory cleaned up: ${repoPath}`);
        logger.debug(`Ramp-Up Score: ${rampUpScore}`);
        return rampUpScore;
    } catch (error) {
        console.error('Error in ramp-up score calculation:', error);
        return 0; // Return 0 in case of error
    }
}
