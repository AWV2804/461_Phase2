// import mongoose from 'mongoose';

// const rootName = 'ece30861defaultadminuser'
// // Define a schema
// /**
//  * Schema for how entries are stored in the database for users
//  */
// export const userSchema = new mongoose.Schema({
//     username: String,
//     accessLevel: Number,
//     userHash: String
// });

// /**
//  * Schema for how entries are stored in the database for packages
//  */
// // export const User = mongoose.model('User', userSchema); // This defines the "users" collection

// /**
//  * Package collection
//  */
// // export const Package = mongoose.model('Package', packageSchema)
// /**
//  * Connect to MongoDB Cloud Database
//  * @param database name of the database you want to create a connection to
//  * @returns error on failure to connect
//  */
// export async function connectToMongoDB(database: string) {
//     try {
//         // Replace with your actual MongoDB URI
//         // const mongoURI = `mongodb+srv://askannan:IxnNnCuO0ICCZXGl@cluster0.9gpef.mongodb.net/${database}?retryWrites=true&w=majority&appName=Cluster0`;
//         const mongoURI = `mongodb+srv://askannan:IxnNnCuO0ICCZXGl@cluster0.9gpef.mongodb.net/${database}?retryWrites=true&w=majority&appName=Cluster0`;
//         // Connect to the MongoDB cluster
//         const db = mongoose.createConnection(mongoURI);
//         console.log('Connected to MongoDB');
//         return [true, db];
//     } catch (error) {
//         console.error('Error connecting to MongoDB', error);
//         return [false, error];
//         // process.exit(1); // Exit process with failure
//     }
// }

// /**
//  * Disconnects from MongoDB Cloud Database
//  * @returns error on failure to disconnect
//  */
// export async function disconnectMongoDB(db: mongoose.Connection) {
//     try {
//         await db.close();
//         console.log('Disconnected from MongoDB');
//         return [true, null];
//     } catch (error) {
//         console.error('Error disconnecting from MongoDB:', error);
//         return [false, error];
//     }
// }

// /**
//  * Deletes the connected database and then disconnects from Mongo
//  * @returns error if it cannot delete a database
//  */
// export async function deleteDB(db: mongoose.Connection) {
//     try {
//         // const db = mongoose.connection.db;
//         // if (!db) {
//         //     console.error('No database found');
//         //     return [false, Error('No database found')];
//         // }
//         const success = await db.dropDatabase();
//         console.log('Database deleted successfully');
//         return [true, success];
//     } catch (error) {
//         console.error('Error deleting database:', error);
//         return [false, error];
//     } finally {
//         await mongoose.disconnect();
//         console.log('Disconnected from MongoDB');
//     }
// }

// /**
//  * Deletes all User documents except for the one with the specified userHash.
//  * @param rootHash - The userHash of the User document to retain.
//  * @returns A promise that resolves to a tuple indicating success and a message or error.
//  */
// export async function deleteUsersExcept(User: mongoose.Model<any>): Promise<[boolean, string | Error]> {
//     try {
//         // Validate rootHash

//         // Perform deletion: delete all users where userHash is not equal to rootHash
//         const deleteResult = await User.deleteMany({ username: { $ne: rootName } });

//         // console.log(`Deleted ${deleteResult.deletedCount} user(s) except for userHash: ${rootName}`);
//         return [true, `Deleted ${deleteResult.deletedCount} user(s) except for userHash: ${rootName}`];
//     } catch (error) {
//         console.error('Error deleting users:', error);
//         return [false, error as Error];
//     }
// }

// export async function addUser(username: String, userHash: String, accessLevel: Number, User: mongoose.Model<any>) {
//     try {
//         const newUser = new User({
//             username: username,
//             accessLevel: accessLevel,
//             userHash: userHash
//         });
//         const user = await getUserByName(username, User);
//         if(user[0] == true) {
//             console.log('User already exists');
//             return [false, Error('User already exists')];
//         }
//         const result = await newUser.save();
//         console.log('User added:', result);
//         return [true, result];
//     } catch (error) {
//         console.error('Error adding user:', error);
//         return [false, error];
//     }
// }

// export async function removeUserByName(username: string, User: mongoose.Model<any>) {
//     try {
//         const result = await User.deleteOne({ username });
//         console.log('User removed:', result);
//         return [true, result];
//     } catch (error) {
//         console.error('Error removing user:', error);
//         return [false, error];
//     }
// }

// export async function getAllUsers(User: mongoose.Model<any>) {
//     try {
//         const users = await User.find();
//         console.log('All Users:', users);
//         return [true, users];
//     } catch (error) {
//         console.error('Error fetching users:', error);
//         return [false, error];
//     }
// }

// export async function getUserByHash(userHash: string, User: mongoose.Model<any>) {
//     try {
//         const user = await User.findOne({ userHash });
//         if(user == null) {
//             console.log('User not found');
//             return [false, Error('User not found')];
//         }
//         console.log('User found:', user);
//         return [true, user];
//     } catch (error) {
//         console.error('Error fetching user:', error);
//         return [false, error];
//     }
// }

// export async function getUserByName(username: String, User: mongoose.Model<any>) {
//     try {
//         const user = await User.findOne({ username });
//         if(user == null) {
//             console.log('User not found');
//             return [false, Error('User not found')];
//         }
//         console.log('User found:', user);
//         return [true, user];
//     } catch (error) {
//         console.error('Error fetching user:', error);
//         return [false, error];
//     }
// }

// /**
//  * Test function to check functionality
//  */
// async function run() {
//     await connectToMongoDB('Users');
//     await addUser('Annan', 'x', 1);
//     const x = await getAllUsers();
//     console.log(x);
//     console.log();
//     // const y = await getUserByHash(rootHash);
//     // console.log(y); 
//     // console.log();
//     await addUser('Annan', 'y', 1);
//     // const z = await removeUserByHash('y');
//     // console.log(z);
//     // console.log();
//     const d = await deleteUsersExcept();
//     console.log(d);
//     console.log();
//     await disconnectMongoDB();
// }

// // run();





