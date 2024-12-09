// utils.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import axios from 'axios';
import * as s3 from '../src/s3_utils';
import jwt from 'jsonwebtoken';
import esbuild from 'esbuild';
import {
  parseRepositoryUrl,
  processGithubURL,
  processNPMUrl,
  calculatePackageSize,
  getPackageDependencies,
  findAndReadReadme,
  generateToken,
  verifyToken,
  extractFiles,
  treeShakePackage,
  createZipFromDir,
} from '../src/utils';

import { TextEncoder, TextDecoder } from 'node:util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

vi.mock('fs');
vi.mock('path');
vi.mock('adm-zip');
// Mock AdmZip constructor
vi.mock('adm-zip', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      getEntries: vi.fn(() => [
        { entryName: 'file1.txt', getData: vi.fn(() => Buffer.from('content1')) },
        { entryName: 'file2.txt', getData: vi.fn(() => Buffer.from('content2')) },
      ]),
      extractEntryTo: vi.fn(),
    })),
  };
});


vi.mock('axios');
vi.mock('../src/s3_utils', () => ({
  requestContentFromS3: vi.fn().mockResolvedValue(Buffer.from('mocked data')),
}));
vi.mock('jsonwebtoken');
vi.mock('esbuild', () => ({
    build: vi.fn().mockResolvedValue({}),
  }));



vi.mock('isomorphic-git', () => ({
  clone: vi.fn().mockResolvedValue(undefined),
}));

describe('utils.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseRepositoryUrl', () => {
    it('should parse a GitHub shorthand URL', () => {
      const result = parseRepositoryUrl('github:owner/repo');
      expect(result).toBe('https://github.com/owner/repo');
    });

    it('should parse a git URL and return an HTTPS URL', () => {
      const result = parseRepositoryUrl('git@github.com:owner/repo.git');
      expect(result).toBe('https://github.com/owner/repo');
    });

    it('should return url for non github url', () => {
      const result = parseRepositoryUrl('invalid_url');
      expect(result).toBe('invalid_url');
    });
  });

  describe('processNPMUrl', () => {
    it('should return the GitHub URL from NPM package data', async () => {
      vi.spyOn(axios, 'get').mockResolvedValue({
        data: { repository: { url: 'https://github.com/bendrucker/smallest' } },
      });

      const result = await processNPMUrl('https://www.npmjs.com/package/smallest');
      expect(result).toStrictEqual('https://github.com/bendrucker/smallest');
    });
  });

  describe('calculatePackageSize', () => {
    it('should calculate and return package size in MB', async () => {
      (s3.requestContentFromS3 as jest.Mock).mockResolvedValue(Buffer.from('mock_content'));
      const result = await calculatePackageSize('mock_hash');
      expect(result).toBeCloseTo(0.00000954); // Size of 'mock_content' in MB
    });
  });

  describe('getPackageDependencies', () => {
    it('should return dependencies from package.json', async () => {
      const mockZip = {
        getEntry: vi.fn().mockReturnValue({
          getData: () => Buffer.from(JSON.stringify({ dependencies: { dep1: '1.0.0' } })),
        }),
      };
      AdmZip.mockImplementation(() => mockZip);
      (s3.requestContentFromS3 as jest.Mock).mockResolvedValue(Buffer.from('mock_zip', 'base64'));

      const result = await getPackageDependencies('mock_hash');
      expect(result).toEqual(['dep1']);
    });
  });

  describe('findAndReadReadme', () => {
    it('should return the content of the first README file found', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('Mock README content');

      const result = findAndReadReadme(['README.md'], '/mock/dir');
      expect(result).toBe('Mock README content');
    });
  });

  describe('generateToken', () => {
    it('should generate a JWT token', () => {
      jwt.sign.mockReturnValue('mock_token');
      const result = generateToken(true, 'group1');
      expect(result).toBe('mock_token');
    });
  });

  describe('verifyToken', () => {
    it('should verify and update a valid token', () => {
      jwt.verify.mockReturnValue({ usageCount: 999, isAdmin: true, userGroup: 'group1' });
      jwt.sign.mockReturnValue('updated_token');
      const result = verifyToken('mock_token');
      expect(result).toEqual({
        updatedToken: 'updated_token',
        isAdmin: true,
        userGroup: 'group1',
      });
    });
  });

  describe('extractFiles', () => {
    it('should extract files from a ZIP archive', async () => {
      const mockZip = {
        getEntries: vi.fn().mockReturnValue([
          { entryName: 'file1.txt', isDirectory: false, extractTo: vi.fn() },
        ]),
      };
      
      AdmZip.mockImplementation(() => mockZip);
  
      // Call the function and wait for the async operation to complete
      await extractFiles(mockZip as any, '/mock/output');
  
    });
  });


  describe('createZipFromDir', () => {
    it('should create a ZIP file from a directory', async () => {
      const mockZip = {
        addLocalFolder: vi.fn(),
        toBuffer: vi.fn().mockReturnValue(Buffer.from('mock_zip')),
      };
      AdmZip.mockImplementation(() => mockZip);
      const result = await createZipFromDir('/mock/dir');
      expect(result).toEqual(Buffer.from('mock_zip'));
    });
  });
});
