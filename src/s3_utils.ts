import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const s3 = new S3Client({ region: 'us-east-1' });
const BUCKET_NAME = "ece461-zipped-packages";

const streamToBuffer = (stream: Readable): Promise<Buffer> => { // Convert stream to buffer. allows for downloading files from s3
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
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
       ContentType: 'application/octet-stream', // Adjust as needed
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

export { s3, BUCKET_NAME, streamToBuffer };
