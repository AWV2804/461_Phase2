import fs from 'fs/promises';
import { expect, test, vi, afterAll } from 'vitest';
import { urlhandler } from '../src/urlhandler';
import logger from '../src/logging.js';
import { npmHandler } from '../src/npmHandler';
import { gitAPIHandler } from '../src/gitAPIHandler';

// Mocking the necessary modules
vi.mock('fs', () => {
    return {
        promises: {
            readFile: vi.fn(),
        },
        default: {
            promises: {
                readFile: vi.fn(),
            },
        },
    };
});
vi.mock('../src/logging.js');
vi.mock('../src/npmHandler');
vi.mock('../src/gitAPIHandler');

test('identify should return GitHub for GitHub URLs', () => {
    const handler = new urlhandler('https://github.com/user/repo');
    const result = handler.identify(handler.url);
    expect(result).toBe('GitHub');
});

test('identify should return NPM for NPM URLs', () => {
    const handler = new urlhandler('https://www.npmjs.com/package/package-name');
    const result = handler.identify(handler.url);
    expect(result).toBe('NPM');
});

test('identify should return Not Found for unsupported URLs', () => {
    const handler = new urlhandler('https://example.com');
    const result = handler.identify(handler.url);
    expect(result).toBe('Not Found');
});

// test('processUrlsFromFile should process all URLs from the file', async () => {
//     const mockFilePath = 'test-urls.txt';
//     const mockFileData = 'https://github.com/user/repo\nhttps://www.npmjs.com/package/package-name\n';
//     const mockUrls = ['https://github.com/user/repo', 'https://www.npmjs.com/package/package-name'];

//     // Mocking fs.promises.readFile to return the mocked file content
//     (fs.readFile as any).mockResolvedValue(mockFileData);

//     // Mocking logger.info to avoid real logging
//     (logger.info as any).mockImplementation(() => {});

//     // Mocking urlhandler.handle method
//     const handleMock = vi.fn();
//     (urlhandler.prototype.handle as any) = handleMock;

//     // Call the function under test
//     await urlhandler.processUrlsFromFile(mockFilePath);

//     // Ensure that fs.readFile was called with the correct file path and encoding
//     expect(fs.readFile).toHaveBeenCalledWith(mockFilePath, 'utf-8');

//     // Ensure that each URL was processed by the urlhandler
//     expect(handleMock).toHaveBeenCalledTimes(mockUrls.length);

//     // Ensure that logger.info was called with each URL
//     for (const url of mockUrls) {
//         expect(logger.info).toHaveBeenCalledWith(`Processing URL: ${url}`);
//     }
// });

 //    expect(fs.readFile).toHaveBeenCalledWith(mockFilePath, 'utf-8');
test('handle should delegate GitHub URLs to gitAPIHandler', async () => {
    const mockGitHandler = {
        getRepoDetails: vi.fn().mockResolvedValue({}),
        getContributors: vi.fn().mockResolvedValue([]),
        getCommitHistory: vi.fn().mockResolvedValue([]),
        getIssues: vi.fn().mockResolvedValue([]),
        getPullRequests: vi.fn().mockResolvedValue([]),
    };

    // Mocking gitAPIHandler
    (gitAPIHandler as any).mockImplementation(() => mockGitHandler);

    const handler = new urlhandler('https://github.com/user/repo');
    await handler.handle();

    // Ensure gitAPIHandler methods were called
    expect(mockGitHandler.getRepoDetails).toHaveBeenCalled();
    expect(mockGitHandler.getContributors).toHaveBeenCalled();
    expect(mockGitHandler.getCommitHistory).toHaveBeenCalled();
    expect(mockGitHandler.getIssues).toHaveBeenCalled();
    expect(mockGitHandler.getPullRequests).toHaveBeenCalled();
});

test('handle should delegate NPM URLs to npmHandler', async () => {
    const mockNpmData = {
        gitUrl: 'https://github.com/user/repo',
    };

    const mockGitHandler = {
        getContributors: vi.fn().mockResolvedValue([]),
        getCommitHistory: vi.fn().mockResolvedValue([]),
        getIssues: vi.fn().mockResolvedValue([]),
        getPullRequests: vi.fn().mockResolvedValue([]),
    };

    // Mocking npmHandler and gitAPIHandler
    (npmHandler.processPackage as any).mockResolvedValue(mockNpmData);
    (gitAPIHandler as any).mockImplementation(() => mockGitHandler);

    const handler = new urlhandler('https://www.npmjs.com/package/package-name');
    await handler.handle();

    // Ensure npmHandler was called
    expect(npmHandler.processPackage).toHaveBeenCalledWith('package-name');

    // Ensure gitAPIHandler methods were called
    expect(mockGitHandler.getContributors).toHaveBeenCalled();
    expect(mockGitHandler.getCommitHistory).toHaveBeenCalled();
    expect(mockGitHandler.getIssues).toHaveBeenCalled();
    expect(mockGitHandler.getPullRequests).toHaveBeenCalled();
});

test('handle should log error for unsupported URLs', async () => {
    const handler = new urlhandler('https://example.com');
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    await handler.handle();

    // Ensure console.error was called for unsupported URLs
    expect(consoleErrorMock).toHaveBeenCalledWith('Unsupported URL type.');
});

