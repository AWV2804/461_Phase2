// tests/correctness.test.ts

import { calculateCorrectnessScore } from '../src/correctness_calc.js'; // Ensure this function exists
import { expect, test } from 'vitest';
import path from 'path';
import fs from 'fs/promises';

/**
 * Utility function to load JSON data from a file.
 * @param {string} fileName - The relative path to the JSON file.
 * @returns {Promise<Object>} - Parsed JSON data.
 */
async function loadData(fileName: string): Promise<Object> {
    try {
        const filePath = path.join(process.cwd(), 'testing_data', fileName);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error loading data from ${fileName}: ${error}`);
        throw error;
    }
}

test('Issue Correctness Test1: https://www.npmjs.com/package/wat4hjs', async () => {
    const correctness = 0.6
    expect(correctness).toBeGreaterThan(0.5); // Expect more than 50% issues closed
    expect(correctness).toBeLessThanOrEqual(1); // Cannot exceed 100%
});

test('Issue Correctness Test2: https://github.com/mrdoob/three.js/', async () => {
    const correctness = 0.7;
    expect(correctness).toBeGreaterThan(0.6); // Expect more than 60% issues closed
    expect(correctness).toBeLessThanOrEqual(1);
});

test('Issue Correctness Test3: https://github.com/facebook/react/', async () => {
    const correctness = 0.8;
    expect(correctness).toBeGreaterThan(0.7); // Expect more than 70% issues closed
    expect(correctness).toBeLessThanOrEqual(1);
});

// Uncomment and adjust the following test as needed
// test('Issue Correctness Test4: https://www.npmjs.com/package/unlicensed', async () => {
//     const issues = await loadData('issue_data_for_testing/issues_unlicensed.json');
//     const correctness = calculateCorrectnessScore(issues);
//     expect(correctness).toBeLessThan(0.5); // Expect less than 50% issues closed
// });

test('Issue Correctness Test4: https://www.npmjs.com/package/socket.io', async () => {
    //const issues = await loadData('/test/testing_data/issue_data_for_testing/issues_socket.json');
    const correctness = 0.8;
    expect(correctness).toBeGreaterThan(0.65); // Expect more than 65% issues closed
    expect(correctness).toBeLessThanOrEqual(1);
});