import mongoose from 'mongoose';
const rootName = 'ece30861defaultadminuser'
import logger from './logging.js';
import dotenv from 'dotenv';

dotenv.config();
// Define a schema
/**
 * Schema for how entries are stored in the database for users
 */
export const userSchema = new mongoose.Schema({
    username: String,
    isAdmin: Boolean,
    userHash: String,
    userGroup: String
});
/**
 * Schema for how entries are stored in the database for packages
 */
export const packageSchema = new mongoose.Schema({
    id: String,
    name: String,
    url: String,
    score: String,
    version: String,
    packageId: String,
    netScore: Number,
    ingestionMethod: String,
    README: String,
    secret: Boolean,
    userGroup: String
});

// might want to make this just go update if it finds that a package with the same name is already present
/**
 * Add a new package to the database
 * @param name Package name
 * @param url Package url
 * @param score Optional score for package
 * @param version Optional version for package
 * @param previousVersion Optional previous versions for package
 * @returns savedPackage of the package saved or error if the package couldn't be stored
 */
export async function addNewPackage(name: String, url: String, Package: mongoose.Model<any>, packageId?: String, score?: String, version?: String, netScore?: Number, ingestionMethod?: String, README?: String, secret?: Boolean, userGroup?: String) {
    const newPackage = new Package({
        name: name,
        url: url,
        score: score,
        version: version,
        packageId: packageId,
        netScore: netScore,
        ingestionMethod: ingestionMethod,
        README: README,
        secret: secret,
        userGroup: userGroup
    });

    try {
        const savedPackage = await newPackage.save();
        logger.info('Package saved:', savedPackage);
        return [true, savedPackage];
    } catch (error) {
        logger.debug('Error saving package:', error);
        return [false, error];
    }
}



export async function removePackageByNameOrHash(identifier: string, Package: mongoose.Model<any>) : Promise<boolean> {
    try {
        const result = await Package.deleteOne({ $or : [{ name: identifier }, { packageId: identifier }] });
        logger.info('Package removed:', result);
        return true;
    } catch (error) {
        logger.debug('Error removing package:', identifier);
        return false;
    }
}


/**
 * Gets all the packages in the collection
 * @returns All packages or error
 */
export async function getAllPackages(Package: mongoose.Model<any>) {
    try {
        const users = await Package.find();
        logger.info('All Users:', users);
        return [true, users];
    } catch (error) {
        logger.debug('Error fetching users:', error);
        return [false, error];
    }
}

/**
 * 
 * @param identifier Hash or name of the package
 * @param Package Mongoose model for Package DB
 * @returns If the package was found and the package or error
 */
export async function getPackagesByNameOrHash(identifier: string, Package: mongoose.Model<any> ): Promise<[boolean, any[] | Error]> {
    try {
      // Find all packages where `name` or `hash` matches the identifier and sort by version
      const packages = await Package.find({
        $or: [{ name: identifier }, { packageId: identifier }],
      });
    packages.sort((a, b) => {
      const versionA = a.version.split('.').map(Number);
      const versionB = b.version.split('.').map(Number);

      for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
        const numA = versionA[i] || 0;
        const numB = versionB[i] || 0;

        if (numA > numB) return -1;
        if (numA < numB) return 1;
      }

      return 0;
    });
  
      if (packages.length === 0) {
        console.log('No packages found with the name or hash:', identifier);
        return [false, [-1]];
      }
  
      console.log('Packages found:', packages);
      return [true, packages];
    } catch (error) {
      console.error('Error fetching packages:', error);
      return [false, error];
    }
}
  

export async function findPackageByRegEx(regex: string, Package: mongoose.Model<any>) {
    try {
        // Apply the regex to both 'name' and 'README' fields
        const results = await Package.find({
            $or: [
                { name: { $regex: regex, $options: 'i' } }, // Case-insensitive regex on 'name'
                { README: { $regex: regex, $options: 'i' } } // Case-insensitive regex on 'README'
            ],
        });
        return [true, results];
    } catch (error) {
        logger.debug('Error fetching packages:', error);
        return [false, error];
    }
}


/**
 * Schema for how entries are stored in the database for packages
 */
// export const User = mongoose.model('User', userSchema); // This defines the "users" collection

/**
 * Connect to MongoDB Cloud Database
 * @param database name of the database you want to create a connection to
 * @returns error on failure to connect
 */
export function connectToMongoDB(database: string) {
    try {
        // Replace with your actual MongoDB URI
        const mongoURI = `mongodb+srv://askannan2:v5fStlVVtNA5cQdP@cluster0.9gpef.mongodb.net/${database}?retryWrites=true&w=majority&appName=Cluster0`;
        // Connect to the MongoDB cluster
        const db = mongoose.createConnection(mongoURI);
        // if(db == null) {
        //     logger.debug('Error connecting to MongoDB');
        //     return [false, Error('Error connecting to MongoDB')];
        // }
        logger.info('Connected to MongoDB');
        return [true, db];
    } catch (error) {
        logger.debug('Error connecting to MongoDB', error);
        return [false, error];
        // process.exit(1); // Exit process with failure
    }
}

/**
 * Disconnects from MongoDB Cloud Database
 * @returns error on failure to disconnect
 */
export async function disconnectMongoDB(db: mongoose.Connection) {
    try {
        await db.close();
        logger.info('Disconnected from MongoDB');
        return [true, null];
    } catch (error) {
        logger.debug('Error disconnecting from MongoDB:', error);
        return [false, error];
    }
}

/**
 * Deletes the connected database and then disconnects from Mongo
 * @returns error if it cannot delete a database
 */
export async function deleteDB(db: mongoose.Connection) {
    try {
        // const db = mongoose.connection.db;
        // if (!db) {
        //     logger.debug('No database found');
        //     return [false, Error('No database found')];
        // }
        const success = await db.dropDatabase();
        logger.info('Database deleted successfully');
        return [true, success];
    } catch (error) {
        logger.debug('Error deleting database:', error);
        return [false, error];
    }
    // } finally {
    //     await mongoose.disconnect();
    //     console.log('Disconnected from MongoDB');
    // }
}

/**
 * Deletes all User documents except for the one with the specified userHash.
 * @param rootHash - The userHash of the User document to retain.
 * @returns A promise that resolves to a tuple indicating success and a message or error.
 */
export async function deleteUsersExcept(User: mongoose.Model<any>): Promise<[boolean, string | Error]> {
    try {
        // Validate rootHash
        // Perform deletion: delete all users where userHash is not equal to rootHash
        const deleteResult = await User.deleteMany({ username: { $ne: rootName } });

        // logger.info(`Deleted ${deleteResult.deletedCount} user(s) except for userHash: ${rootName}`);
        return [true, `Deleted ${deleteResult.deletedCount} user(s) except for userHash: ${rootName}`];
    } catch (error) {
        logger.debug('Error deleting users:', error);
        return [false, error as Error];
    }
}

export async function addUser(username: String, userHash: String, isAdmin: Boolean, userGroup: String, User: mongoose.Model<any>) {
    try {
        const newUser = new User({
            username: username,
            isAdmin: isAdmin,
            userHash: userHash,
            userGroup: userGroup
        });
        const user = await getUserByName(username, User);
        if(user[0] == true) {
            logger.info('User already exists');
            return [false, Error('User already exists')];
        }
        const result = await newUser.save();
        logger.info('User added:', result);
        return [true, result];
    } catch (error) {
        logger.debug('Error adding user:', error);
        return [false, error];
    }
}

export async function removeUserByName(username: string, User: mongoose.Model<any>) {
    try {
        const user = await getUserByName(username, User);
        if (user[0] === false) {
            logger.info('User does not exist');
            return [false, Error('User does not exist')];
        }
        const result = await User.deleteOne({ username });
        logger.info('User removed:', result);
        return [true, result];
    } catch (error) {
        logger.debug('Error removing user:', error);
        return [false, error];
    }
}

export async function getAllUsers(User: mongoose.Model<any>) {
    try {
        const users = await User.find();
        logger.info('All Users:', users);
        return [true, users];
    } catch (error) {
        logger.debug('Error fetching users:', error);
        return [false, error];
    }
}

export async function getUserByHash(userHash: string, User: mongoose.Model<any>) {
    try {
        const user = await User.findOne({ userHash });
        if(user == null) {
            logger.info('User not found');
            return [false, Error('User not found')];
        }
        logger.info('User found:', user);
        return [true, user];
    } catch (error) {
        logger.debug('Error fetching user:', error);
        return [false, error];
    }
}

export async function getUserByName(username: String, User: mongoose.Model<any>) {
    try {
        const user = await User.findOne({ username });
        if(user == null) {
            logger.info('User not found');
            return [false, Error('User not found')];
        }
        logger.info('User found:', user);
        return [true, user];
    } catch (error) {
        logger.debug('Error fetching user:', error);
        return [false, error];
    }
}

/**
 * Test function to check functionality
 */
// async function run() {
//     await connectToMongoDB('Users');
//     await addUser('Annan', 'x', 1);
//     const x = await getAllUsers();
//     logger.info(x);
//     logger.info();
//     // const y = await getUserByHash(rootHash);
//     // logger.info(y); 
//     // logger.info();
//     await addUser('Annan', 'y', 1);
//     // const z = await removeUserByHash('y');
//     // logger.info(z);
//     // logger.info();
//     const d = await deleteUsersExcept();
//     logger.info(d);
//     logger.info();
//     await disconnectMongoDB();
// }
