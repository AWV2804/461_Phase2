import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const s3 = new S3Client({ region: 'us-east-1' });
const BUCKET_NAME = "ece461-zipped-packages";

const streamToBuffer = (stream: Readable): Promise<Buffer> => { // Convert stream to buffer. allows for downloading files from s3
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}

export async function requestContentFromS3(hashKey: string): Promise<Buffer> {
    const getObjectParams = {
        Bucket: BUCKET_NAME,
        Key: hashKey
    };

    try {
        const request = await s3.send(new GetObjectCommand(getObjectParams));
        console.log('Successfully retrieved content from S3 with key:', hashKey);   
        return await streamToBuffer(request.Body as Readable);
    } catch (error) {
        console.error('Error retrieving content from S3:', error);
        throw error; // Re-throw the error for upstream
    }
}

export async function clearS3Bucket() {
  try {
    // List objects in the bucket
    const listParams = {
      Bucket: BUCKET_NAME,
    };

    const listCommand = new ListObjectsV2Command(listParams);
    const listObjects = await s3.send(listCommand);

    const objects = listObjects.Contents;

    if (objects && objects.length > 0) {
      // Prepare objects for deletion
      const deleteParams = {
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: objects.map((obj) => ({ Key: obj.Key })),
        },
      };

      // Create the DeleteObjectsCommand
      const deleteCommand = new DeleteObjectsCommand(deleteParams);
      const deleteResponse = await s3.send(deleteCommand);

      console.log('Deleted objects:', deleteResponse.Deleted);

      // If more objects exist, call the function recursively
      if (listObjects.IsTruncated) {
        await clearS3Bucket();
      }
    } else {
      console.log('No objects to delete.');
    }
  } catch (error) {
    console.error('Error clearing S3 bucket:', error);
  }
}

/**
* Uploads the Base64-encoded content to S3 with the provided hash as the key.
* @param content - The Base64-encoded content to upload.
* @param hashKey - The SHA256 hash to use as the S3 object key.
*/
export async function uploadContentToS3(content: string, hashKey: string): Promise<void> {
   // Since the content is already Base64-encoded, we upload it directly as a string.
   // Optionally, you can set the ContentEncoding to 'base64' and ContentType to 'application/zip'

   // Create the PutObjectCommand with necessary parameters
   const putObjectParams = {
       Bucket: BUCKET_NAME,
       Key: hashKey,
       Body: content,
       ContentType: 'application/zip', // Adjust as needed
       ContentEncoding: 'base64',
   };

   try {
       // Upload the content to S3
       await s3.send(new PutObjectCommand(putObjectParams));
       console.log(`Successfully uploaded Base64-encoded content to S3 with key: ${hashKey}`);
   } catch (error) {
       console.error('Error uploading content to S3:', error);
       throw error; // Re-throw the error for upstream handling
   }
}

export async function removeContentFromS3(hashKey: string): Promise<void> {
    const deleteObjectParams = {
        Bucket: BUCKET_NAME,
        Key: hashKey
    };

    try {
        await s3.send(new DeleteObjectCommand(deleteObjectParams));
        console.log(`Successfully removed content from S3 with key: ${hashKey}`);
    } catch (error) {
        console.error('Error removing content from S3:', error);
        throw error; // Re-throw the error for upstream handling
    }
}

export { s3, BUCKET_NAME, streamToBuffer };
