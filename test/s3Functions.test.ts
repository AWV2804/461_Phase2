import { describe, it, expect, vi } from 'vitest';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { 
    requestContentFromS3, 
    uploadContentToS3, 
    removeContentFromS3 
} from '../src/s3_utils';

vi.mock('@aws-sdk/client-s3', () => {
    const sendMock = vi.fn();
    return {
        S3Client: vi.fn(() => ({ send: sendMock })),
        GetObjectCommand: vi.fn(),
        PutObjectCommand: vi.fn(),
        DeleteObjectCommand: vi.fn(),
    };
});

const mockS3Client = new S3Client();
const mockSend = mockS3Client.send as unknown as vi.Mock;

const mockStream = (data: string): Readable => {
    const stream = new Readable();
    stream.push(data);
    stream.push(null); // Indicate end of stream
    return stream;
};

describe('S3 Functions', () => {
    afterEach(() => {
        mockSend.mockReset();
    });

    describe('requestContentFromS3', () => {
        it('should retrieve content from S3 and return as a buffer', async () => {
            const hashKey = 'test-key';
            const mockData = 'mock-content';
            const readableStream = mockStream(mockData);

            mockSend.mockResolvedValue({
                Body: readableStream,
            });

            const result = await requestContentFromS3(hashKey);

            expect(result.toString()).toBe(mockData);
            expect(mockSend).toHaveBeenCalledWith(expect.any(GetObjectCommand));
        });

        it('should throw an error if S3 request fails', async () => {
            const hashKey = 'test-key';

            mockSend.mockRejectedValue(new Error('S3 error'));

            await expect(requestContentFromS3(hashKey)).rejects.toThrow('S3 error');
            expect(mockSend).toHaveBeenCalledWith(expect.any(GetObjectCommand));
        });
    });

    describe('uploadContentToS3', () => {
        it('should upload Base64-encoded content to S3', async () => {
            const content = 'mock-base64-content';
            const hashKey = 'test-key';

            mockSend.mockResolvedValue({});

            await uploadContentToS3(content, hashKey);

            expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));
        });

        it('should throw an error if S3 upload fails', async () => {
            const content = 'mock-base64-content';
            const hashKey = 'test-key';

            mockSend.mockRejectedValue(new Error('S3 error'));

            await expect(uploadContentToS3(content, hashKey)).rejects.toThrow('S3 error');
            expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));
        });
    });

    describe('removeContentFromS3', () => {
        it('should remove content from S3', async () => {
            const hashKey = 'test-key';

            mockSend.mockResolvedValue({});

            await removeContentFromS3(hashKey);

            expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
        });

        it('should throw an error if S3 deletion fails', async () => {
            const hashKey = 'test-key';

            mockSend.mockRejectedValue(new Error('S3 error'));

            await expect(removeContentFromS3(hashKey)).rejects.toThrow('S3 error');
            expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
        });
    });
});
