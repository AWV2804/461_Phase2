import { describe, test, beforeAll, afterAll, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import {
    addNewPackage,
    getAllPackages,
    getPackagesByNameOrHash,
    findPackageByRegEx,
    addUser,
    removeUserByName,
    getAllUsers,
    getUserByHash,
    getUserByName,
    deleteUsersExcept,
    connectToMongoDB,
    disconnectMongoDB,
    deleteDB
} from '../src/database';

let dbConnection;
let Package;
let User;

// Mocking the database connection and models with constructors
beforeAll(async () => {
    // Mock database connection object
    dbConnection = { model: vi.fn() };

    // Mock Package and User constructors
    Package = vi.fn(function (data) {
        Object.assign(this, data);
    });
    User = vi.fn(function (data) {
        Object.assign(this, data);
    });

    // Define mock methods on Package and User prototypes
    Package.prototype.save = vi.fn();
    Package.find = vi.fn();
    Package.findOne = vi.fn();
    Package.updateOne = vi.fn();
    Package.collection = { drop: vi.fn() };

    User.prototype.save = vi.fn();
    User.find = vi.fn();
    User.findOne = vi.fn();
    User.deleteOne = vi.fn();
    User.deleteMany = vi.fn();
});

afterAll(async () => {
    // No real database connection to close, so we leave this empty
});

describe('Package Functions', () => {
    /**
     * Test to ensure that a new package can be added successfully.
     */
    test('addNewPackage should add a package successfully', async () => {
        const packageData = { name: 'NewPackage', url: 'http://newpackage.com', version: '1.0.0' };
        Package.prototype.save.mockResolvedValue(packageData);
        const response = await addNewPackage('NewPackage', 'http://newpackage.com', Package, '1.0.0');
        expect(response[0]).toBe(true);
        expect(response[1]).toEqual(packageData);
    });

    /**
     * Test to ensure that an error is handled correctly when saving a package fails.
     */
    test('addNewPackage should handle error on save failure', async () => {
        const errorMessage = 'Save failed';
        Package.prototype.save.mockRejectedValueOnce(new Error(errorMessage));
        const response = await addNewPackage('FailPackage', 'http://failpackage.com', Package);
        expect(response[0]).toBe(false);
        expect(response[1]).toBeInstanceOf(Error);
        expect(response[1].message).toBe(errorMessage);
    });

    /**
     * Test to ensure that all packages can be retrieved successfully.
     */
    test('getAllPackages should retrieve all packages', async () => {
        const packages = [{ name: 'Package1' }, { name: 'Package2' }];
        Package.find.mockResolvedValue(packages);
        const response = await getAllPackages(Package);
        expect(response[0]).toBe(true);
        expect(response[1]).toEqual(packages);
    });

    /**
     * Test to ensure that an error is handled correctly when retrieving all packages fails.
     */
    test('getAllPackages should handle error on retrieval failure', async () => {
        Package.find.mockRejectedValueOnce(new Error('Retrieval failed'));
        const response = await getAllPackages(Package);
        expect(response[0]).toBe(false);
    });

    /**
     * Test to ensure that packages can be found by name or hash.
     */
    test('getPackagesByNameOrHash should find packages by name or hash', async () => {
        const packages = [{ name: 'NewPackage' }];
        Package.find.mockResolvedValue(packages);
        const response = await getPackagesByNameOrHash('NewPackage', Package);
        expect(response[0]).toBe(true);
        expect(response[1]).toEqual(packages);
    });

    /**
     * Test to ensure that an error is handled correctly when searching for packages by name or hash fails.
     */
    test('getPackagesByNameOrHash should handle error on search failure', async () => {
        Package.find.mockRejectedValueOnce(new Error('Search failed'));
        const response = await getPackagesByNameOrHash('FailPackage', Package);
        expect(response[0]).toBe(false);
    });

    /**
     * Test to ensure that packages can be found by regex.
     */
    test('findPackageByRegEx should find packages by regex', async () => {
        const packages = [{ name: 'pyplot' }, { name: 'python-lib' }];
        Package.find.mockResolvedValue(packages);
        const response = await findPackageByRegEx('py', Package);
        expect(response[0]).toBe(true);
        expect(response[1]).toEqual(packages);
    });

    /**
     * Test to ensure that an error is handled correctly when searching for packages by regex fails.
     */
    test('findPackageByRegEx should handle error on search failure', async () => {
        Package.find.mockRejectedValueOnce(new Error('Search failed'));
        const response = await findPackageByRegEx('FailRegex', Package);
        expect(response[0]).toBe(false);
    });
});

describe('User Functions', () => {
    /**
     * Test to ensure that a new user can be added successfully.
     */
    test('addUser should add a user successfully', async () => {
        const userData = { username: 'TestUser', userHash: 'testhash123', isAdmin: true };
        User.prototype.save.mockResolvedValue(userData);
        const response = await addUser('TestUser', 'testhash123', true, '', User);
        expect(response[0]).toBe(true);
        expect(response[1]).toEqual(userData);
    });

    /**
     * Test to ensure that an error is handled correctly when saving a user fails.
     */
    test('addUser should handle error on user save failure', async () => {
        User.prototype.save.mockRejectedValueOnce(new Error('Save failed'));
        const response = await addUser('FailUser', 'userhash', true, '', User);
        expect(response[0]).toBe(false);
    });

    /**
     * Test to ensure that a user can be removed by name successfully.
     */
    test('removeUserByName should remove a user by name', async () => {
        User.deleteOne.mockResolvedValue({ deletedCount: 1 });
        const response = await removeUserByName('TestUser', User);
        expect(response[0]).toBe(true);
    });

    /**
     * Test to ensure that an error is handled correctly when removing a user by name fails.
     */
    test('removeUserByName should handle error on delete failure', async () => {
        User.deleteOne.mockRejectedValueOnce(new Error('Delete failed'));
        const response = await removeUserByName('FailUser', User);
        expect(response[0]).toBe(false);
    });

    /**
     * Test to ensure that all users can be retrieved successfully.
     */
    test('getAllUsers should retrieve all users', async () => {
        const users = [{ username: 'User1' }, { username: 'User2' }];
        User.find.mockResolvedValue(users);
        const response = await getAllUsers(User);
        expect(response[0]).toBe(true);
        expect(response[1]).toEqual(users);
    });

    /**
     * Test to ensure that an error is handled correctly when retrieving all users fails.
     */
    test('getAllUsers should handle error on retrieval failure', async () => {
        User.find.mockRejectedValueOnce(new Error('Retrieval failed'));
        const response = await getAllUsers(User);
        expect(response[0]).toBe(false);
    });

    /**
     * Test to ensure that a user can be found by hash successfully.
     */
    test('getUserByHash should find a user by hash', async () => {
        const user = { userHash: 'testhash123', username: 'TestUser' };
        User.findOne.mockResolvedValue(user);
        const response = await getUserByHash('testhash123', User);
        expect(response[0]).toBe(true);
        expect(response[1]).toEqual(user);
    });

    /**
     * Test to ensure that an error is handled correctly when searching for a user by hash fails.
     */
    test('getUserByHash should handle error when searching by hash', async () => {
        User.findOne.mockRejectedValueOnce(new Error('Search failed'));
        const response = await getUserByHash('userhash', User);
        expect(response[0]).toBe(false);
    });

    /**
     * Test to ensure that a user can be found by name successfully.
     */
    test('getUserByName should find a user by name', async () => {
        const user = { username: 'TestUser', userHash: 'testhash123' };
        User.findOne.mockResolvedValue(user);
        const response = await getUserByName('TestUser', User);
        expect(response[0]).toBe(true);
        expect(response[1]).toEqual(user);
    });

    /**
     * Test to ensure that an error is handled correctly when searching for a user by name fails.
     */
    test('getUserByName should handle error when searching by name', async () => {
        User.findOne.mockRejectedValueOnce(new Error('Search failed'));
        const response = await getUserByName('username', User);
        expect(response[0]).toBe(false);
    });

    /**
     * Test to ensure that all users except one can be deleted successfully.
     */
    test('deleteUsersExcept should delete all users except one', async () => {
        User.deleteMany.mockResolvedValue({ deletedCount: 5 });
        const response = await deleteUsersExcept(User);
        expect(response[0]).toBe(true);
        expect(response[1]).toContain('Deleted');
    });

    /**
     * Test to ensure that an error is handled correctly when deleting all users except one fails.
     */
    test('deleteUsersExcept should handle error during delete operation', async () => {
        User.deleteMany.mockRejectedValueOnce(new Error('Delete failed'));
        const response = await deleteUsersExcept(User);
        expect(response[0]).toBe(false);
    });
});

describe('Database Connection Functions', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    /**
     * Test to ensure that the database connection is established successfully.
     */
    test('connectToMongoDB should connect successfully', async () => {
        mongoose.createConnection = vi.fn().mockResolvedValueOnce({
            close: vi.fn().mockResolvedValueOnce(true)
        });
        const response = await connectToMongoDB('testDatabase');
        expect(response[0]).toBe(true);
        expect(mongoose.createConnection).toHaveBeenCalledWith(expect.stringContaining('testDatabase'));
    });

    /**
     * Test to ensure that the database connection is closed successfully.
     */
    test('disconnectMongoDB should disconnect successfully', async () => {
        const mockConnection = { close: vi.fn().mockResolvedValueOnce(true) };
        const response = await disconnectMongoDB(mockConnection as unknown as mongoose.Connection);
        expect(response[0]).toBe(true);
        expect(mockConnection.close).toHaveBeenCalled();
    });

    /**
     * Test to ensure that an error is handled correctly when closing the database connection fails.
     */
    test('disconnectMongoDB should handle disconnection failure', async () => {
        const mockConnection = { close: vi.fn().mockRejectedValueOnce(new Error('Disconnection failed')) };
        const response = await disconnectMongoDB(mockConnection as unknown as mongoose.Connection);
        expect(response[0]).toBe(false);
        expect(response[1]).toBeInstanceOf(Error);
        expect(response[1].message).toBe('Disconnection failed');
        expect(mockConnection.close).toHaveBeenCalled();
    });

    /**
     * Test to ensure that the database is deleted successfully.
     */
    test('deleteDB should delete the database successfully', async () => {
        const mockConnection = { dropDatabase: vi.fn().mockResolvedValueOnce(true) };
        const response = await deleteDB(mockConnection as unknown as mongoose.Connection);
        expect(response[0]).toBe(true);
        expect(mockConnection.dropDatabase).toHaveBeenCalled();
    });

    /**
     * Test to ensure that an error is handled correctly when deleting the database fails.
     */
    test('deleteDB should handle error on delete failure', async () => {
        const mockConnection = { dropDatabase: vi.fn().mockRejectedValueOnce(new Error('Delete failed')) };
        const response = await deleteDB(mockConnection as unknown as mongoose.Connection);
        expect(response[0]).toBe(false);
        expect(response[1]).toBeInstanceOf(Error);
        expect(response[1].message).toBe('Delete failed');
        expect(mockConnection.dropDatabase).toHaveBeenCalled();
    });
});