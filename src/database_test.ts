import mongoose from 'mongoose';

// Define a schema
const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    accessLevel: Number
});

const packageSchema = new mongoose.Schema({
    name: String,
    url: String,
    score: String,
    version: String,
    prev_versions: [String]
});
// const User = mongoose.model('User', userSchema); // This defines the "users" collection
const Package = mongoose.model('Package', packageSchema)

export async function connectToMongoDB(database: string) {
    try {
        // Replace with your actual MongoDB URI
        const mongoURI = `mongodb+srv://askannan:IxnNnCuO0ICCZXGl@cluster0.9gpef.mongodb.net/${database}?retryWrites=true&w=majority&appName=Cluster0`;

        // Connect to the MongoDB cluster
        await mongoose.connect(mongoURI);
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Error connecting to MongoDB', error);
        process.exit(1); // Exit process with failure
    }
}

export async function disconnectMongoDB() {
    try {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error disconnecting from MongoDB:', error);
    }
}

// might want to make this just go update if it finds that a package with the same name is already present
export async function addNewPackage(name: String, url: String, score?: String, version?: String, previousVersion?: String) {
    const newPackage = new Package({
        name: name,
        url: url,
        score: score,
        version: version,
        previousVersions: previousVersion
    });

    try {
        const savedPackage = await newPackage.save();
        console.log('Package saved:', savedPackage);
    } catch (error) {
        console.error('Error saving package:', error);
    }
}

export async function updatePackageVersion(name: string, newVersion: string) {
    try {
        // Find the package by name
        const packageDoc = await Package.findOne({ name });

        if (packageDoc) {
            // Push the current version to the previousVersions array
            if(packageDoc.version != null) {
                packageDoc.prev_versions.push(packageDoc.version);
            }

            // Set the new version
            packageDoc.version = newVersion;

            // Save the updated document
            const updatedPackage = await packageDoc.save();
            console.log('Package updated:', updatedPackage);
        } else {
            console.log('Package not found');
        }
    } catch (error) {
        console.error('Error updating package:', error);
    }
}

export async function updatePackageScore(name: string, newScore: string) {
    try {
        const result = await Package.updateOne(
            { name },
            { $set: { score: newScore } }
        );
        console.log('Update result:', result);
    } catch (error) {
        console.error('Error updating package:', error);
    }
}

export async function deleteDB() {
    try {
        await mongoose.connection.db.dropDatabase();
        console.log('Database deleted successfully');
    } catch (error) {
        console.error('Error deleting database:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

export async function removeUserCollection() {
    try {
        await Package.collection.drop();
        console.log('User collection removed');
    } catch (error) {
        console.error('Error removing collection:', error);
    }
}

export async function getAllPackages() {
    try {
        const users = await Package.find();
        console.log('All Users:', users);
    } catch (error) {
        console.error('Error fetching users:', error);
    }
}

export async function getPackageByName(name: string) {
    try {
        const pkg = await Package.findOne({ name });
        console.log('User found:', pkg);
    } catch (error) {
        console.error('Error fetching user:', error);
    }
}

export async function findPackagesByPartialName(partialName: string) {
    try {
        // Use regex to find packages where the name contains the partial string (case-insensitive)
        const pkgs = await Package.find({ name: { $regex: partialName, $options: 'i' } });
        
        if (pkgs.length > 0) {
            console.log('Found packages:', pkgs);
        } else {
            console.log('No packages found with the partial name:', partialName);
        }
        return pkgs
    } catch (error) {
        console.error('Error fetching packages:', error);
    }
}

async function run() {
    await connectToMongoDB('Packages');
    await addNewPackage('Example', 'http://example.com');
    await updatePackageScore('Example', 'test score: 75');
    await updatePackageVersion('Example', '1.0.0');
    await updatePackageVersion('Example', '1.0.1');
    await addNewPackage('python-lib', 'python-lib.com', '', '1.0.1');
    await addNewPackage('pyplot', 'pyplot.com');
    await getAllPackages();
    console.log();
    await getPackageByName('Example');
    const pkgs = await findPackagesByPartialName('py');
    console.log(pkgs);
    await disconnectMongoDB();
}

run();

// UNCOMMENT LATER WHEN NEEDED

// async function addUser(name: String, email: String, password: String, accessLevel: Number) {
//     try {
//         const newUser = new User({
//             name: name,
//             email: email,
//             password: password,
//             accessLevel: accessLevel
//         });

//         const result = await newUser.save();
//         console.log('User added:', result);
//     } catch (error) {
//         console.error('Error adding user:', error);
//     }
// }

// async function removeUserByEmail(email: string) {
//     try {
//         const result = await User.deleteOne({ email });
//         console.log('User removed:', result);
//     } catch (error) {
//         console.error('Error removing user:', error);
//     }
// }

// // async function removeUsersByAge(age: number) {
// //     try {
// //         const result = await User.deleteMany({ age });
// //         console.log('Users removed:', result);
// //     } catch (error) {
// //         console.error('Error removing users:', error);
// //     }
// // }



// async function getAllUsers() {
//     try {
//         const users = await User.find();
//         console.log('All Users:', users);
//     } catch (error) {
//         console.error('Error fetching users:', error);
//     }
// }

// async function getUserByEmail(email: string) {
//     try {
//         const user = await User.findOne({ email });
//         console.log('User found:', user);
//     } catch (error) {
//         console.error('Error fetching user:', error);
//     }
// }




