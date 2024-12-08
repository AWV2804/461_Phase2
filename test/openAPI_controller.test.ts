// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as db from '../src/database'; // Mock this first
import * as util from '../src/utils';
import logger from '../src/logging';
import * as s3 from '../src/s3_utils';
// Mock the external dependencies
import request from 'supertest';
import { app } from '../src/openAPI_controller';
import SHA256 from 'crypto-js/sha256';
import AdmZip from 'adm-zip';
import { formToJSON } from 'axios';
import { get } from 'http';
import * as rate from '../src/rate';
vi.mock('../src/utils');
vi.mock('../src/database');
vi.mock('../src/logging');
vi.mock('../src/s3_utils');
vi.mock('../src/rate');
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

describe('DELETE /reset', () => {
  let mockPackageModel: any;
  let mockUserModel: any;
  
  beforeEach(() => {
    // Reset packageDB and userDB to a known state before each test
    // Assuming that one user collection already exists by default
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    
    vi.spyOn(db, 'connectToMongoDB').mockImplementation((dbName) => {
      if (dbName === 'Packages') {
        return [null, { model: () => mockPackageModel }];
      } else if (dbName === 'Users') {
        return [null, { model: () => mockUserModel }];
      }
      return [null, {}];
    });

    // Mock Package model
    mockPackageModel = {
      countDocuments: vi.fn().mockResolvedValue(1),
      deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    };

    // Mock UserModel
    mockUserModel = {
      countDocuments: vi.fn().mockResolvedValue(2),
      deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    };


    vi.mocked(util.verifyToken).mockImplementation((token: string) => {
      if (token === 'valid-token') {
        return { updatedToken: 'new-valid-token', isAdmin: true, userGroup: 'admin' };
      }
      if (token === 'invalid-token') {
        return { updatedToken: new Error('Token is invalid or expired'), isAdmin: null, userGroup: 'user' };
      }
      if (token === 'non-admin-token') {
        return { updatedToken: 'new-valid-token', isAdmin: false, userGroup: 'user' };
      }
      return new Error('Token is invalid or expired');
    });

    vi.mocked(db.deleteDB).mockImplementation(() => {
      return [true, void 0];
    });
    vi.mocked(db.deleteUsersExcept).mockImplementation(() => {
      return [true, void 0];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 403 if the authentication header is missing', async () => {
    const response = await request(app).delete('/reset');
    expect(response.status).toBe(403);
    expect(response.text).toBe('Missing Authentication Header');
  });

  it('should return 403 if the token is invalid or expired', async () => {
    const response = await request(app)
      .delete('/reset')
      .set('X-Authorization', 'invalid-token');
    expect(response.status).toBe(403);
    expect(response.text).toContain('Invalid or expired token');
  });

  it('should return 403 if the user does not have admin permissions', async () => {
    const response = await request(app)
      .delete('/reset')
      .set('X-Authorization', 'non-admin-token');
    expect(response.status).toBe(401);
    expect(response.text).toBe('You do not have the correct permissions to reset the registry.');
  });

  it('should return 500 if the database deletion fails', async () => {
    // Cause db.deleteDB to fail
    vi.mocked(db.deleteDB).mockRejectedValueOnce(new Error('Database deletion failed'));
    const response = await request(app)
      .delete('/reset')
      .set('X-Authorization', 'valid-token');

    expect(response.status).toBe(500);
    expect(response.text).toBe('Error deleting database');
  });

  it('should return 200 if the registry is successfully reset', async () => {
    const response = await request(app)
      .delete('/reset')
      .set('X-Authorization', 'valid-token');
    expect(response.status).toBe(200);
    expect(response.text).toBe('Registry has been reset.');
  });
});

describe('POST /package/byRegEx', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    vi.mocked(util.verifyToken).mockImplementation((token) => {
      if (token === 'valid-token') {
        return { updatedToken: 'new-valid-token', isAdmin: true, userGroup: 'admin' };
      }
      if (token === 'invalid-token') {
        return { updatedToken: new Error('Token is invalid or expired'), isAdmin: null, userGroup: 'user' };
      }
      if (token === 'non-admin-token') {
        return { updatedToken: 'new-valid-token', isAdmin: false, userGroup: 'user' };
      }
      return new Error('Token is invalid or expired');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 403 if the authentication header is missing', async () => {
    const response = await request(app).post('/package/byRegEx').send({ RegEx: '.*' });
    expect(response.status).toBe(403);
    expect(response.text).toBe('Authentication failed due to invalid or missing AuthenticationToken');
  });

  it('should return 403 if the token is invalid or expired', async () => {
    const response = await request(app)
      .post('/package/byRegEx')
      .set('X-Authorization', 'invalid-token')
      .send({ RegEx: '.*' });
    expect(response.status).toBe(403);
    expect(response.text).toContain('Invalid or expired token');
  });

  it('should return 403 if the user does not have admin permissions', async () => {
    const response = await request(app)
      .post('/package/byRegEx')
      .set('X-Authorization', 'non-admin-token')
      .send({ RegEx: '.*' });
    expect(response.status).toBe(403);
    expect(response.text).toBe('You do not have the correct permissions to reset the registry.');
  });

  it('should return 400 if the request is malformed (missing RegEx)', async () => {
    const response = await request(app)
      .post('/package/byRegEx')
      .set('X-Authorization', 'valid-token');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Malformed Request' });
  });

  it('should return 500 if database retrieval fails', async () => {
    vi.mocked(db.findPackageByRegEx).mockResolvedValueOnce([false, null]);

    const response = await request(app)
      .post('/package/byRegEx')
      .set('X-Authorization', 'valid-token')
      .send({ RegEx: '.*' });
    expect(response.status).toBe(500);
    expect(response.text).toBe('Error retrieving packages');
  });

  it('should return 404 if no packages are found', async () => {
    vi.mocked(db.findPackageByRegEx).mockResolvedValueOnce([true, []]);

    const response = await request(app)
      .post('/package/byRegEx')
      .set('X-Authorization', 'valid-token')
      .send({ RegEx: '.*' });
    expect(response.status).toBe(404);
    expect(response.text).toBe('No packages found');
  });

  it('should return 200 and the formatted packages if packages are found', async () => {
    const mockPackages = [
      { name: 'Package1', version: '1.0.0', packageId: '123' },
      { name: 'Package2', version: '2.0.0', packageId: '456' },
    ];
    vi.mocked(db.findPackageByRegEx).mockResolvedValueOnce([true, mockPackages]);

    const response = await request(app)
      .post('/package/byRegEx')
      .set('X-Authorization', 'valid-token')
      .send({ RegEx: '.*' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { Name: 'Package1', Version: '1.0.0', ID: '123' },
      { Name: 'Package2', Version: '2.0.0', ID: '456' },
    ]);
  });
});

describe('GET /package/:id/rate', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    vi.mocked(util.verifyToken).mockImplementation((token) => {
      if (token === 'valid-token') {
        return { updatedToken: 'new-valid-token', isAdmin: true, userGroup: 'admin' };
      }
      if (token === 'invalid-token') {
        return { updatedToken: new Error('Token is invalid or expired'), isAdmin: null, userGroup: 'user' };
      }
      if (token === 'non-admin-token') {
        return { updatedToken: 'new-valid-token', isAdmin: false, userGroup: 'user' };
      }
      return new Error('Token is invalid or expired');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 403 if the authentication header is missing', async () => {
    const response = await request(app).get('/package/123/rate');
    expect(response.status).toBe(403);
    expect(response.text).toBe('Missing Authentication Header');
  });

  it('should return 403 if the token is invalid or expired', async () => {
    const response = await request(app)
      .get('/package/123/rate')
      .set('X-Authorization', 'invalid-token');
    expect(response.status).toBe(403);
    expect(response.text).toContain('Invalid or expired token');
  });

  it('should return 403 if the user does not have admin permissions', async () => {
    const response = await request(app)
      .get('/package/123/rate')
      .set('X-Authorization', 'non-admin-token');
    expect(response.status).toBe(403);
    expect(response.text).toBe('You do not have the correct permissions to reset the registry.');
  });

  it('should return 400 if the package ID is missing', async () => {
    const response = await request(app)
      .get('/package//rate') // Missing ID in the URL
      .set('X-Authorization', 'valid-token');
    expect(response.status).toBe(400);
    expect(response.text).toBe('Missing package ID');
  });

  it('should return 404 if the package is not found', async () => {
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValueOnce([false, [-1]]);
    const response = await request(app)
      .get('/package/123/rate')
      .set('X-Authorization', 'valid-token');
    expect(response.status).toBe(404);
    expect(response.text).toContain('Package not found');
  });

  it('should return 500 if the database retrieval fails', async () => {
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValueOnce([false, 'Database error']);
    const response = await request(app)
      .get('/package/123/rate')
      .set('X-Authorization', 'valid-token');
    expect(response.status).toBe(500);
    expect(response.text).toBe('Error retrieving package: Database error');
  });

  it('should return 500 if the package contains null fields in scores', async () => {
    const mockPackage = [
      {
        score: JSON.stringify({
          BusFactor: null, // Null field to simulate the error
          RampUp: 5,
        }),
      },
    ];
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValueOnce([true, mockPackage]);
    const response = await request(app)
      .get('/package/123/rate')
      .set('X-Authorization', 'valid-token');
    expect(response.status).toBe(500);
    expect(response.text).toBe('Package rating choked');
  });

  it('should return 500 if the package contains null fields in scores', async () => {
    const mockPackage = [
      {
        score: JSON.stringify({
          BusFactor: null, // Simulating a null value
          BusFactorLatency: 5,
          Correctness: 7,
          Correctness_Latency: 4,
          RampUp: 6,
          RampUp_Latency: 3,
          ResponsiveMaintainer: 9,
          ResponsiveMaintainer_Latency: 2,
          License: 8,
          License_Latency: 1,
          GoodPinningPractice: 7,
          GoodPinningPractice_Latency: 2,
          PullRequest: 8,
          PullRequest_Latency: 3,
          NetScore: 7.5,
          NetScore_Latency: 1.2,
        }),
      },
    ];
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValueOnce([true, mockPackage]);
    const response = await request(app)
      .get('/package/123/rate')
      .set('X-Authorization', 'valid-token');
    expect(response.status).toBe(500);
    expect(response.text).toBe('Package rating choked');
  });
  
  it('should return 200 with formatted scores if the package is successfully retrieved', async () => {
    const mockPackage = [
      {
        score: JSON.stringify({
          BusFactor: 8,
          BusFactor_Latency: 5,
          Correctness: 7,
          Correctness_Latency: 4,
          RampUp: 9,
          RampUp_Latency: 3,
          ResponsiveMaintainer: 6,
          ResponsiveMaintainer_Latency: 2,
          License: 8,
          License_Latency: 1,
          DependencyPinning: 7,
          DependencyPinning_Latency: 2,
          PullRequestsCodeMetric: 8,
          PullRequestsCodeMetric_Latency: 3,
          NetScore: 7.5,
          NetScore_Latency: 1.2,
        }),
      },
    ];
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValueOnce([true, mockPackage]);
    const response = await request(app)
      .get('/package/123/rate')
      .set('X-Authorization', 'valid-token');
    expect(response.status).toBe(200);
    console.log(response.body);
    expect(response.body).toEqual({
      BusFactor: 8,
      BusFactorLatency: 5,
      Correctness: 7,
      CorrectnessLatency: 4,
      RampUp: 9,
      RampUpLatency: 3,
      ResponsiveMaintainer: 6,
      ResponsiveMaintainerLatency: 2,
      LicenseScore: 8,
      LicenseScoreLatency: 1,
      GoodPinningPractice: 7,
      GoodPinningPracticeLatency: 2,
      PullRequest: 8,
      PullRequestLatency: 3,
      NetScore: 7.5,
      NetScoreLatency: 1.2,
    });
  });
});

describe('GET /package/:id', () => {
  
  const validToken = 'valid-monkeyBusiness-token'; // Replace with your valid token value
  const packageID = '12345'; // Replace with a valid package ID for your tests
  const mockPackageInfo = {
    name: 'Test Package',
    version: '1.0.0',
    jsProgram: 'console.log("Hello World");',
  };

  beforeEach(() => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    vi.mocked(util.verifyToken).mockImplementation((token) => {
      if (token === 'valid-token') {
        return { updatedToken: 'new-valid-token', isAdmin: true, userGroup: 'admin' };
      }
      if (token === 'invalid-token') {
        return { updatedToken: new Error('Token is invalid or expired'), isAdmin: null, userGroup: 'user' };
      }
      if (token === 'non-admin-token') {
        return { updatedToken: 'new-valid-token', isAdmin: false, userGroup: 'user' };
      }
      return new Error('Token is invalid or expired');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Missing authentication token
  it('should return 403 if the authentication token is missing', async () => {
    const response = await request(app).get(`/package/${packageID}`);
    expect(response.status).toBe(403);
    expect(response.text).toBe('Authentication failed due to invalid or missing AuthenticationToken');
  });

  // 2. Invalid authentication token
  it('should return 403 if the authentication token is invalid', async () => {
    const response = await request(app)
      .get(`/package/${packageID}`)
      .set('X-Authorization', 'invalid-token');
    expect(response.status).toBe(403);
    expect(response.text).toBe(`Invalid or expired token`);
  });

  // 3. Missing package ID
  it('should return 400 if the package ID is missing', async () => {
    const response = await request(app)
      .get('/package/')
      .set('X-Authorization', validToken);
    expect(response.status).toBe(400);
    expect(response.text).toBe('There is missing field(s) in the PackageID or it is formed improperly, or it is invalid.');
  });

  // 4. Package not found
  it('should return 404 if the package does not exist', async () => {
    vi.spyOn(db, 'getPackagesByNameOrHash').mockResolvedValue([false, [-1]]);
    const response = await request(app)
      .get(`/package/${packageID}`)
      .set('X-Authorization', validToken);
    expect(response.status).toBe(404);
    expect(response.text).toBe(`Package not found: -1`);
  });

  // 5. Successful retrieval
  it('should return 200 and package details if the package exists', async () => {
    vi.spyOn(db, 'getPackagesByNameOrHash').mockResolvedValue([true, [mockPackageInfo]]);
    vi.spyOn(s3, 'requestContentFromS3').mockResolvedValue(Buffer.from('package-content'));

    const response = await request(app)
      .get(`/package/${packageID}`)
      .set('X-Authorization', validToken);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      metadata: {
        Name: mockPackageInfo.name,
        Version: mockPackageInfo.version,
        ID: packageID,
      },
      data: {
        Content: 'package-content',
        JSProgram: mockPackageInfo.jsProgram,
      },
    });
  });

  // 6. Internal server error during DB query
  it('should return 500 if there is a database error', async () => {
    vi.spyOn(db, 'getPackagesByNameOrHash').mockRejectedValue(new Error('DB error'));
    const response = await request(app)
      .get(`/package/${packageID}`)
      .set('X-Authorization', validToken);
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Bad Request' });
  });

  // 7. Internal server error during S3 retrieval
  it('should return 500 if there is an S3 error', async () => {
    vi.spyOn(db, 'getPackagesByNameOrHash').mockResolvedValue([true, [mockPackageInfo]]);
    vi.spyOn(s3, 'requestContentFromS3').mockRejectedValue(new Error('S3 error'));

    const response = await request(app)
      .get(`/package/${packageID}`)
      .set('X-Authorization', validToken);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Bad Request' });
  });
});

describe('PUT /authenticate', () => {
  beforeEach(() => {
    vi.restoreAllMocks(); // Restore mocks before each test
  });

  it('should return 400 for malformed requests', async () => {
    const malformedRequests = [
      { Secret: { password: 'password123' } }, // Missing User
      { User: { name: 'test', isAdmin: true } }, // Missing Secret
      { User: { name: 'test' }, Secret: { password: 'password123' } }, // Missing isAdmin in User
      { User: { isAdmin: true }, Secret: { password: 'password123' } }, // Missing name in User
    ];

    for (const reqBody of malformedRequests) {
      const response = await request(app).put('/authenticate').send(reqBody);
      expect(response.status).toBe(400);
      expect(response.text).toEqual('Malformed AuthenticationRequest');
    }
  });

  it('should return 401 for invalid username', async () => {
    vi.mocked(db.getUserByName).mockResolvedValueOnce([false, null]);

    const response = await request(app)
      .put('/authenticate')
      .send({ User: { name: 'invalid-user', isAdmin: false }, Secret: { password: 'password123' } });
    expect(response.status).toBe(401);
    expect(response.text).toEqual('Invalid username');
  });

  it('should return 401 for invalid password', async () => {
    const mockUser = { name: 'valid-user', userHash: SHA256('correct-password').toString(), isAdmin: false, userGroup: 'user' };
    vi.mocked(db.getUserByName).mockResolvedValueOnce([true, mockUser]);

    const response = await request(app)
      .put('/authenticate')
      .send({ User: { name: 'valid-user', isAdmin: false }, Secret: { password: 'wrong-password' } });
    expect(response.status).toBe(401);
    expect(response.text).toEqual('Invalid password');
  });

  it('should return 200 with auth token for valid credentials', async () => {
    const mockUser = { name: 'valid-user', userHash: SHA256('correct-password').toString(), isAdmin: true, userGroup: 'admin' };
    const mockToken = 'mock-auth-token';
    vi.mocked(db.getUserByName).mockResolvedValueOnce([true, mockUser]);
    vi.mocked(util.generateToken).mockReturnValueOnce(mockToken);

    const response = await request(app)
      .put('/authenticate')
      .send({ User: { name: 'valid-user', isAdmin: true }, Secret: { password: 'correct-password' } });
    expect(response.status).toBe(200);
    expect(response.text).toEqual(`bearer ${mockToken}`);
  });

  it('should return 500 for internal server errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console errors during testing
    vi.mocked(db.getUserByName).mockRejectedValueOnce(new Error('Database error'));

    const response = await request(app)
      .put('/authenticate')
      .send({ User: { name: 'valid-user', isAdmin: true }, Secret: { password: 'correct-password' } });
    expect(response.status).toBe(500);
    expect(response.text).toEqual('Bad Request');
  });
});

describe('GET /package/:id/cost', () => {
  const mockAuthToken = 'valid-token';
  const mockPackageId = '12345';
  const mockPackageInfo = [{ secret: false, userGroup: 'user' }];

  beforeEach(async () => {
    vi.restoreAllMocks(); // Restore all mocks before each test
  });

  it('should return 403 if the authentication header is missing', async () => {
    const response = await request(app).get(`/package/${mockPackageId}/cost`);
    expect(response.status).toBe(403);
    expect(response.text).toBe('Missing Authentication Header');
  });

  it('should return 403 if the token is invalid or expired', async () => {
    vi.mocked(util.verifyToken).mockImplementationOnce(() => {
      throw new Error('Invalid or expired token');
    });

    const response = await request(app)
      .get(`/package/${mockPackageId}/cost`)
      .set('X-Authorization', 'invalid-token');
    expect(response.status).toBe(403);
    expect(response.text).toBe('Invalid or expired token.');
  });

  it('should return 404 if the package does not exist', async () => {
    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValueOnce([false, [-1]]);

    const response = await request(app)
      .get(`/package/${mockPackageId}/cost`)
      .set('X-Authorization', mockAuthToken);
    expect(response.status).toBe(404);
    expect(response.text).toBe('Package does not exist');
  });

  it('should return 500 if there is an error retrieving package info', async () => {
    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValueOnce([false, 'DB error']);

    const response = await request(app)
      .get(`/package/${mockPackageId}/cost`)
      .set('X-Authorization', mockAuthToken);
    expect(response.status).toBe(500);
    expect(response.text).toBe('Server error while retrieving package info.');
  });

  it('should return 403 if the user belongs to the wrong group', async () => {
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValueOnce([true, [{ secret: true, userGroup: 'admin' }]]);
    vi.mocked(util.verifyToken).mockReturnValueOnce({ userGroup: 'user' });

    const response = await request(app)
      .get(`/package/${mockPackageId}/cost`)
      .set('X-Authorization', mockAuthToken);
    expect(response.status).toBe(403);
    expect(response.text).toBe('No access: Wrong user group');
  });

  it('should return 400 for missing or invalid package ID', async () => {
    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });
    const response = await request(app)
      .get(`/package//cost`)
      .set('X-Authorization', mockAuthToken);
    expect(response.status).toBe(400);
    expect(response.text).toBe('Missing or invalid Package ID');
  });

  it('should return 404 if `package.json` is not found', async () => {

    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });
    vi.mocked(s3.requestContentFromS3).mockResolvedValueOnce(Buffer.from('mocked-binary-content'));
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValueOnce([true, mockPackageInfo]);

    const mockZip = {
      getEntry: vi.fn().mockReturnValue(null),
    };
    AdmZip.mockImplementation(() => mockZip);

    const response = await request(app)
      .get(`/package/${mockPackageId}/cost`)
      .set('X-Authorization', mockAuthToken);
    expect(response.status).toBe(404);
    expect(response.text).toBe('package.json not found in the package.');
  });

  it('should return 404 if the package is not found in S3', async () => {
    vi.mocked(s3.requestContentFromS3).mockRejectedValueOnce(new Error('NotFound'));
    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValueOnce([true, mockPackageInfo]);

    const response = await request(app)
      .get(`/package/${mockPackageId}/cost`)
      .set('X-Authorization', mockAuthToken);
    expect(response.status).toBe(404);
    expect(response.text).toBe('Package not found in S3.');
  });

  it('should return 500 if there is a server error while retrieving package cost', async () => {
    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValueOnce([true, mockPackageInfo]);
    vi.mocked(s3.requestContentFromS3).mockRejectedValueOnce(new Error('Server error'));

    const response = await request(app)
      .get(`/package/${mockPackageId}/cost`)
      .set('X-Authorization', mockAuthToken);
    expect(response.status).toBe(500);
    expect(response.text).toBe('Server error while retrieving package cost.');
  });

  it('should return 200 with standalone cost', async () => {
    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValueOnce([true, mockPackageInfo]);
    vi.mocked(util.calculatePackageSize).mockResolvedValueOnce(100);
    vi.mocked(s3.requestContentFromS3).mockResolvedValueOnce(Buffer.from('mocked-binary-content'));

    const mockZip = {
      getEntry: vi.fn().mockReturnValue({
        getData: () => Buffer.from(JSON.stringify({ dependencies: { dep1: '1.0.0' } })),
      }),
    };
    AdmZip.mockImplementation(() => mockZip);
    const response = await request(app)
      .get(`/package/${mockPackageId}/cost`)
      .set('X-Authorization', mockAuthToken);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      [mockPackageId]: { totalCost: 100 },
    });
  });

  it('should return 200 with total cost including dependencies', async () => {
    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValueOnce([true, mockPackageInfo]);
    vi.mocked(util.calculatePackageSize).mockResolvedValue(100);
    vi.mocked(s3.requestContentFromS3)
      .mockResolvedValueOnce(Buffer.from('mocked-binary-content')) // Package itself
      .mockResolvedValueOnce(Buffer.from('mocked-binary-content')); // Dependency

    const mockZip = {
      getEntry: vi.fn().mockReturnValue({
        getData: () => Buffer.from(JSON.stringify({ dependencies: { dep1: '1.0.0' } })),
      }),
    };
    AdmZip.mockImplementation(() => mockZip);

    const response = await request(app)
      .get(`/package/${mockPackageId}/cost`)
      .query({ dependency: true })
      .set('X-Authorization', mockAuthToken);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      [mockPackageId]: { totalCost: 200 },
      dep1: { standaloneCost: 100, totalCost: 100 },
    });
  });
});

describe('POST /create-account', () => {
  const validUserData = {
    username: 'testuser',
    password: 'password123',
    isAdmin: true,
    userGroup: 'admin',
  };

  it('should create a user successfully with valid data', async () => {
    // Mocking the database function to return success
    vi.mocked(db.addUser).mockResolvedValue([true, { username: 'testuser', isAdmin: true, userGroup: 'admin' }]);

    const response = await request(app)
      .post('/create-account')
      .send(validUserData);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('User created successfully');
    expect(response.body.user.username).toBe('testuser');
    expect(vi.mocked(db.addUser)).toHaveBeenCalledWith('testuser', SHA256(validUserData.password).toString(), true, 'admin', expect.anything());
  });

  it('should return 400 with invalid request data (missing username)', async () => {
    const invalidUserData = { ...validUserData, username: '' };

    const response = await request(app)
      .post('/create-account')
      .send(invalidUserData);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid request data');
  });

  it('should return 400 with invalid request data (invalid isAdmin)', async () => {
    const invalidUserData = { ...validUserData, isAdmin: 'invalid' }; // Invalid type for isAdmin

    const response = await request(app)
      .post('/create-account')
      .send(invalidUserData);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid request data');
  });

  it('should return 500 when db.addUser fails', async () => {
    // Simulate a database failure
    vi.mocked(db.addUser).mockResolvedValue([false, 'Database error']);

    const response = await request(app)
      .post('/create-account')
      .send(validUserData);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Failed to create user');
    expect(response.body.details).toBe('Database error');
  });

  it('should return 500 when an unexpected error occurs', async () => {
    // Simulate an unexpected error
    vi.mocked(db.addUser).mockRejectedValue(new Error('Unexpected error'));

    const response = await request(app)
      .post('/create-account')
      .send(validUserData);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Server error');
  });
});

describe('DELETE /delete-account', () => {
  const validRequestData = {
    username: 'adminUser',
    usernameToDelete: 'testuser',
    isAdmin: true,
  };

  it('should delete a user successfully with valid admin data', async () => {
    // Mocking the database function to return success
    vi.mocked(db.removeUserByName).mockResolvedValue([true, { username: 'testuser' }]);

    const response = await request(app)
      .delete('/delete-account')
      .send(validRequestData);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('User deleted successfully');
    expect(response.body.user.username).toBe('testuser');
    expect(vi.mocked(db.removeUserByName)).toHaveBeenCalledWith('testuser', expect.anything());
  });

  it('should return 400 with invalid request data (missing usernameToDelete)', async () => {
    const invalidRequestData = { ...validRequestData, usernameToDelete: '' };

    const response = await request(app)
      .delete('/delete-account')
      .send(invalidRequestData);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid request data');
  });

  it('should return 400 with invalid request data (invalid isAdmin)', async () => {
    const invalidRequestData = { ...validRequestData, isAdmin: 'invalid' }; // Invalid type for isAdmin

    const response = await request(app)
      .delete('/delete-account')
      .send(invalidRequestData);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid request data');
  });

  it('should return 403 when non-admin tries to delete another user', async () => {
    const nonAdminRequestData = {
      username: 'nonAdminUser',
      usernameToDelete: 'testuser',
      isAdmin: false,
    };

    const response = await request(app)
      .delete('/delete-account')
      .send(nonAdminRequestData);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Invalid permissions - Not Admin');
  });

  it('should return 500 when db.removeUserByName fails', async () => {
    // Simulate a database failure
    vi.mocked(db.removeUserByName).mockResolvedValue([false, 'Database error']);

    const response = await request(app)
      .delete('/delete-account')
      .send(validRequestData);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Failed to delete user');
    expect(response.body.details).toBe('Database error');
  });

  it('should return 500 when an unexpected error occurs', async () => {
    // Simulate an unexpected error
    vi.mocked(db.removeUserByName).mockRejectedValue(new Error('Unexpected error'));

    const response = await request(app)
      .delete('/delete-account')
      .send(validRequestData);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Server error');
  });
});

describe('GET /tracks', () => {
  it('should return 200 with all tracks', async () => {
    const plannedTracks = ["Access control track"];
    const response = await request(app).get('/tracks');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ plannedTracks });
  });
});

describe('POST /packages', () => {
  const validPackageQueries = [
    { Name: 'package1', Version: '1.0.0' },
    { Name: 'package2', Version: '^1.0.0' },
  ];

  it('should return all packages with pagination when Name is "*"', async () => {
    const mockPackages = Array(60).fill({ name: 'package', version: '1.0.0', packageId: '123' });

    // Mocking db.getAllPackages to return the mock packages
    vi.mocked(db.getAllPackages).mockResolvedValue([true, mockPackages]);

    const response = await request(app)
      .post('/packages')
      .send([{ Name: '*' }])
      .query({ offset: '0' })
      .set('X-Authorization', 'valid-token');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(50); // Only 50 packages should be returned
    expect(response.headers['offset']).toBe('50'); // Pagination offset should be set
  });

  it('should return specific package queries', async () => {
    const mockPackages = [
      { name: 'package1', version: '1.0.0', packageId: '123' },
      { name: 'package2', version: '^1.0.0', packageId: '124' },
    ];

    // Mocking db.getPackagesByNameOrHash to return mock packages
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValue([true, mockPackages]);
    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });

    const response = await request(app)
      .post('/packages')
      .send(validPackageQueries)
      .query({ offset: '0' })
      .set('X-Authorization', 'valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2); // Should return the two mock packages
  });

  it('should return 400 with invalid request data (empty array)', async () => {
    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });

    const response = await request(app)
      .post('/packages')
      .send([])
      .set('X-Authorization', 'valid-token'); // Empty array

    expect(response.status).toBe(400);
    expect(response.text).toBe('There are missing field(s) in the PackageQuery or it is formed improperly, or is invalid.');
  });

  it('should return 400 with invalid request data (invalid version)', async () => {
    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });

    const invalidPackageQueries = [{ Name: 'package1', Version: '~^1.0.0' }];

    const response = await request(app)
      .post('/packages')
      .send(invalidPackageQueries)
      .set('X-Authorization', 'valid-token');

    expect(response.status).toBe(400);
    expect(response.text).toBe('The \'Version\' cannot be a combination of the different possibilities.');
  });

  it('should handle pagination correctly', async () => {
    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });

    const mockPackages = Array(60).fill({ name: 'package', version: '1.0.0', packageId: '123' });
    
    // Mocking db.getAllPackages to return the mock packages
    vi.mocked(db.getAllPackages).mockResolvedValue([true, mockPackages]);

    const response = await request(app)
      .post('/packages')
      .send([{ Name: '*' }])
      .query({ offset: '0' })
      .set('X-Authorization', 'valid-token'); // Requesting the second page of results

    expect(response.status).toBe(200);
    // console.log(response.body);
    expect(response.body).toHaveLength(50); // Only 50 packages should be returned
    expect(response.headers['offset']).toBe('50'); // Pagination offset should be updated
  });

  it('should return 500 when db.getPackagesByNameOrHash fails', async () => {
    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });

    // Simulating database failure
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValue([false, 'Database error']);

    const response = await request(app)
      .post('/packages')
      .send(validPackageQueries)
      .query({ offset: '0' })
      .set('X-Authorization', 'valid-token');

    expect(response.status).toBe(500);
    expect(response.text).toBe('Internal Server Error');
  });

  it('should return 500 when db.getAllPackages fails', async () => {
    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });

    // Simulating database failure for fetching all packages
    vi.mocked(db.getAllPackages).mockResolvedValue([false, 'Database error']);

    const response = await request(app)
      .post('/packages')
      .send([{ Name: '*' }])
      .query({ offset: '0' })
      .set('X-Authorization', 'valid-token');

    expect(response.status).toBe(500);
    expect(response.text).toBe('Internal Server Error');
  });
});

describe('POST /package', () => {
  let token: string;

  beforeEach(() => {
    token = 'valid_token'; // mock a valid token
    vi.resetAllMocks();
  });

  it('should return 403 if no token is provided', async () => {
    const response = await request(app).post('/package').send({
      Name: 'test-package',
      Content: 'content',
    });

    expect(response.status).toBe(403);
    expect(response.text).toBe('Missing Authentication Header');
  });

  it('should return 403 for invalid token', async () => {
    vi.mocked(util.verifyToken).mockImplementationOnce(() => {
      throw new Error('Invalid or expired token');
    });

    const response = await request(app)
      .post(`/package`)
      .set('X-Authorization', 'invalid-token')
      .send({
        Name: 'test-package',
        Content: 'content',
      });

    expect(response.status).toBe(403);
    expect(response.text).toContain('Invalid or expired token');
  });

  it('should return 403 if the user is not an admin', async () => {
    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: false, userGroup: 'admin' });

    const response = await request(app).post('/package').set('X-Authorization', token).send({
      Name: 'test-package',
      Content: 'content',
    });

    expect(response.status).toBe(403);
    expect(response.text).toBe('You do not have the correct permissions to upload to the database.');
  });

  it('should return 400 if Content and URL are both provided', async () => {
    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });

    const response = await request(app).post('/package').set('X-Authorization', token).send({
      Name: 'test-package',
      Content: 'content',
      URL: 'https://example.com',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Either 'Content' or 'URL' must be set, but not both.");
  });

  it('should return 400 if Name is missing with Content', async () => {
    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });

    const response = await request(app).post('/package').set('X-Authorization', token).send({
      Content: 'content',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("'Name' is required with Content.");
  });

  it('should process package from content and upload to S3', async () => {
    const mockZipEntry = {
      entryName: 'package.json',
      getData: () => Buffer.from(JSON.stringify({ name: 'test-package', version: '1.0.0', "repository": "https://github.com" })),
      toString: () => 'package.json',
    };
    const mockReadmeEntry = {
      entryName: 'README.md',
      getData: () => Buffer.from('mockReadme'),
    };

    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });
    vi.mocked(util.extractFiles).mockResolvedValue();
    vi.mocked(util.treeShakePackage).mockResolvedValue();
    vi.mocked(util.createZipFromDir).mockResolvedValue(Buffer.from('mockZip'));
    vi.mocked(util.parseRepositoryUrl).mockReturnValue('https://github.com');
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValue([false]);
    vi.mocked(s3.uploadContentToS3).mockResolvedValue();
    vi.mocked(db.addNewPackage).mockResolvedValue([true]);
    vi.mocked(rate.rate).mockResolvedValue(['0.5', 0.5]);
    const mockZipBuffer = Buffer.from('mockZip');
    const mockZip = {
      getEntries: vi.fn().mockReturnValue([mockZipEntry, mockReadmeEntry]),
    };
    AdmZip.mockImplementation(() => mockZip);

    const response = await request(app).post('/package').set('X-Authorization', token).send({
      Name: 'test-package',
      Content: 'mockBase64Content',
      debloat: true,
    });

    expect(response.status).toBe(201);
    expect(s3.uploadContentToS3).toHaveBeenCalledWith(mockZipBuffer.toString('base64'), expect.any(String));
  });

  it('should return 409 if the package already exists', async () => {
    const mockZipEntry = {
      entryName: 'package.json',
      getData: () => Buffer.from(JSON.stringify({ name: 'test-package', version: '1.0.0', "repository": "https://github.com" })),
      toString: () => 'package.json',
    };
    const mockReadmeEntry = {
      entryName: 'README.md',
      getData: () => Buffer.from('mockReadme'),
    };
    const existingPackage = {
      version: '1.0.0',
      score: 10,
    };

    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });
    vi.mocked(util.extractFiles).mockResolvedValue();
    vi.mocked(util.treeShakePackage).mockResolvedValue();
    vi.mocked(util.createZipFromDir).mockResolvedValue(Buffer.from('mockZip'));
    vi.mocked(util.parseRepositoryUrl).mockReturnValue('https://github.com');
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValue([true, existingPackage]);
    vi.mocked(s3.uploadContentToS3).mockResolvedValue();
    vi.mocked(db.addNewPackage).mockResolvedValue([true]);
    vi.mocked(rate.rate).mockResolvedValue(['0.5', 0.5]);
    const mockZipBuffer = Buffer.from('mockZip');
    const mockZip = {
      getEntries: vi.fn().mockReturnValue([mockZipEntry, mockReadmeEntry]),
      toBuffer: vi.fn().mockReturnValue(mockZipBuffer),
    };
    AdmZip.mockImplementation(() => mockZip);

    

    const response = await request(app).post('/package').set('X-Authorization', token).send({
      Name: 'test-package',
      Content: 'content',
    });

    expect(response.status).toBe(409);
    console.log(`response: ${response.body}`);
    expect(response.body.metadata.Name).toBe('test-package');
    expect(response.body.metadata.Version).toBe('1.0.0');
  });

  it('should return 424 if the package rating is too low', async () => {
    const mockZipEntry = {
      entryName: 'package.json',
      getData: () => Buffer.from(JSON.stringify({ name: 'test-package', version: '1.0.0', "repository": "https://github.com" })),
      toString: () => 'package.json',
    };
    const mockReadmeEntry = {
      entryName: 'README.md',
      getData: () => Buffer.from('mockReadme'),
    };
    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });
    vi.mocked(util.extractFiles).mockResolvedValue();
    vi.mocked(util.treeShakePackage).mockResolvedValue();
    vi.mocked(util.createZipFromDir).mockResolvedValue(Buffer.from('mockZip'));
    vi.mocked(util.parseRepositoryUrl).mockReturnValue('https://github.com');
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValue([false]);
    vi.mocked(s3.uploadContentToS3).mockResolvedValue();
    vi.mocked(db.addNewPackage).mockResolvedValue([true]);
    vi.mocked(rate.rate).mockResolvedValue(['0.5', 0.4]);
    const mockZipBuffer = Buffer.from('mockZip');
    const mockZip = {
      getEntries: vi.fn().mockReturnValue([mockZipEntry, mockReadmeEntry]),
      toBuffer: vi.fn().mockReturnValue(mockZipBuffer),
    };
    AdmZip.mockImplementation(() => mockZip);

    const response = await request(app).post('/package').set('X-Authorization', token).send({
      Name: 'test-package',
      Content: 'content',
    });

    expect(response.status).toBe(424);
    expect(response.body.data.packageRating).toBe("0.5");
  });

  it('should handle errors during package processing', async () => {
    const mockZipEntry = {
      entryName: 'package.json',
      getData: () => Buffer.from(JSON.stringify({ name: 'test-package', version: '1.0.0', "repository": "https://github.com" })),
      toString: () => 'package.json',
    };
    const mockReadmeEntry = {
      entryName: 'README.md',
      getData: () => Buffer.from('mockReadme'),
    };
    vi.mocked(util.verifyToken).mockReturnValueOnce({ updatedToken: 'new-valid', isAdmin: true, userGroup: 'admin' });
    vi.mocked(util.extractFiles).mockResolvedValue();
    vi.mocked(util.treeShakePackage).mockResolvedValue();
    vi.mocked(util.createZipFromDir).mockResolvedValue(Buffer.from('mockZip'));
    vi.mocked(util.parseRepositoryUrl).mockReturnValue(null);
    vi.mocked(db.getPackagesByNameOrHash).mockResolvedValue([false]);
    vi.mocked(s3.uploadContentToS3).mockResolvedValue();
    vi.mocked(db.addNewPackage).mockResolvedValue([true]);
    vi.mocked(rate.rate).mockResolvedValue(['0.5', 0.4]);
    const mockZipBuffer = Buffer.from('mockZip');
    const mockZip = {
      getEntries: vi.fn().mockReturnValue([mockZipEntry, mockReadmeEntry]),
      toBuffer: vi.fn().mockReturnValue(mockZipBuffer),
    };
    AdmZip.mockImplementation(() => mockZip);

    const response = await request(app).post('/package').set('X-Authorization', token).send({
      Name: 'test-package',
      Content: 'content',
    });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Failed to process package content.');
  });
});