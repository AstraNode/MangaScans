// ============================================================
// MangaScans — S3-Compatible Storage Client
// ============================================================

import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

let s3Client: S3Client | null = null;

function getClient(): S3Client {
    if (!s3Client) {
        s3Client = new S3Client({
            endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
            region: process.env.S3_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
                secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
            },
            forcePathStyle: true, // Required for MinIO
        });
    }
    return s3Client;
}

const BUCKET = process.env.S3_BUCKET || 'mangascans';

/**
 * Upload a file buffer to S3-compatible storage.
 */
export async function uploadFile(
    key: string,
    body: Buffer | Readable,
    contentType: string = 'image/png'
): Promise<string> {
    const client = getClient();
    await client.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: body,
            ContentType: contentType,
        })
    );
    return `${process.env.S3_ENDPOINT}/${BUCKET}/${key}`;
}

/**
 * Generate a presigned URL for downloading.
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const client = getClient();
    return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: BUCKET, Key: key }),
        { expiresIn }
    );
}

/**
 * Download a file as a Buffer.
 */
export async function downloadFile(key: string): Promise<Buffer> {
    const client = getClient();
    const response = await client.send(
        new GetObjectCommand({ Bucket: BUCKET, Key: key })
    );
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(key: string): Promise<void> {
    const client = getClient();
    await client.send(
        new DeleteObjectCommand({ Bucket: BUCKET, Key: key })
    );
}

/**
 * List all files under a prefix.
 */
export async function listFiles(prefix: string): Promise<string[]> {
    const client = getClient();
    const response = await client.send(
        new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
    );
    return (response.Contents || []).map((obj) => obj.Key!).filter(Boolean);
}

/**
 * Generate the storage key for a page image.
 */
export function pageStorageKey(
    projectId: string,
    pageNumber: number,
    stage: 'original' | 'processed' | 'inpainted' | 'final',
    ext: string = 'png'
): string {
    return `projects/${projectId}/pages/${String(pageNumber).padStart(4, '0')}_${stage}.${ext}`;
}
