import { expect, test, vi, beforeEach } from 'vitest';
import { metric_manager } from '../src/metric_manager.js';
import { maintainer_net } from '../src/maintainer_calculator.js';
import { temp_license } from '../src/template_for_license.js';
import { temp_bus_factor_calc } from '../src/new_bus_factor_calc.js';
import { calculateRampUpScore } from '../src/rampUp.js';

// Mocking the dependencies
vi.mock('../src/maintainer_calculator.js', () => ({
    maintainer_net: vi.fn(() => 1),
}));

vi.mock('../src/template_for_license.js', () => ({
    temp_license: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../src/new_bus_factor_calc.js', () => ({
    temp_bus_factor_calc: vi.fn(() => 1),
}));

vi.mock('../src/rampUp.js', () => ({
    calculateRampUpScore: vi.fn(() => Promise.resolve(1)),
}));

let manager: metric_manager;

beforeEach(() => {
    const mockData: any = {}; // Add your mock data here
    const mockContributors: any[] = [];
    const mockIssues: any[] = [];
    const mockPullRequests: any[] = [];
    const mockCommits: any[] = [];
    const mockUrl: string = 'https://github.com/example/repo';
    const tempDir: string = '/tmp/example';
    const mockClosedIssues: any[] = [];

    manager = new metric_manager(mockData, mockContributors, mockIssues, mockPullRequests, mockCommits, mockUrl, tempDir, mockClosedIssues);
});

test('Calculates metrics in parallel', async () => {
    const result = await manager.parallel_metric_and_net_score_calc();

    // Check if the metrics were calculated
    expect(temp_bus_factor_calc).toHaveBeenCalledWith(manager.url, manager.commits);
    expect(calculateRampUpScore).toHaveBeenCalledWith(manager.url, manager.tempDir);
    expect(maintainer_net).toHaveBeenCalledWith(manager.contributors, manager.issues, manager.pullRequests, manager.commits);
    expect(temp_license).toHaveBeenCalledWith(manager.url, manager.tempDir);
    
    // Check that the net score is calculated as expected
    expect(manager.net_score).toBeGreaterThan(0); // Adjust based on expected logic
});

test('Calculates bus factor', () => {
    const result = manager.bus_factor_calc();
    expect(temp_bus_factor_calc).toHaveBeenCalledWith(manager.url, manager.commits);
    expect(result).toBe(1); // Check if the expected return value matches
});