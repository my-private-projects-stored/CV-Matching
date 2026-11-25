import { Client as MinioClient } from "minio";

export const MINIO_BUCKETS = Object.freeze({
  RESUMES: process.env.MINIO_RESUMES_BUCKET || "resumes-bucket",
  COMPANY_ASSETS: process.env.MINIO_ASSETS_BUCKET || "company-assets-bucket",
});

export const DEFAULT_PRESIGNED_TTL_SECONDS = 900;

/**
 * Create a MinIO S3 storage client wrapper with private bucket management & Presigned URLs.
 */
export function createMinioStorage(options = {}, injectedClient = null) {
  const client =
    injectedClient ||
    new MinioClient({
      endPoint: options.endPoint || process.env.MINIO_ENDPOINT || "localhost",
      port: Number.parseInt(String(options.port || process.env.MINIO_PORT || "9000"), 10),
      useSSL:
        options.useSSL !== undefined
          ? Boolean(options.useSSL)
          : String(process.env.MINIO_USE_SSL || "false").toLowerCase() === "true",
      accessKey: options.accessKey || process.env.MINIO_ACCESS_KEY || "minioadmin",
      secretKey: options.secretKey || process.env.MINIO_SECRET_KEY || "minioadmin123",
    });

  async function ensureBucket(bucketName = MINIO_BUCKETS.RESUMES) {
    const exists = await client.bucketExists(bucketName);
    if (!exists) {
      await client.makeBucket(bucketName);
    }
    return { bucketName, created: !exists };
  }

  async function uploadObject({
    bucket = MINIO_BUCKETS.RESUMES,
    objectKey,
    buffer,
    contentType = "application/octet-stream",
    metadata = {},
  }) {
    if (!objectKey) {
      throw new Error("objectKey is required");
    }
    const payload = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || "");
    await ensureBucket(bucket);
    await client.putObject(bucket, objectKey, payload, payload.length, {
      "Content-Type": contentType,
      ...metadata,
    });
    return {
      bucket,
      objectKey,
      size: payload.length,
    };
  }

  async function getObjectBuffer(bucket, objectKey) {
    const stream = await client.getObject(bucket, objectKey);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async function deleteObject(bucket, objectKey) {
    if (!objectKey) return;
    await client.removeObject(bucket, objectKey);
  }

  async function getPresignedDownloadUrl(
    bucket = MINIO_BUCKETS.RESUMES,
    objectKey,
    ttlSeconds = DEFAULT_PRESIGNED_TTL_SECONDS
  ) {
    if (!objectKey) {
      throw new Error("objectKey is required");
    }
    const ttl = Math.max(1, Number.parseInt(String(ttlSeconds || DEFAULT_PRESIGNED_TTL_SECONDS), 10));
    return client.presignedGetObject(bucket, objectKey, ttl);
  }

  return {
    client,
    ensureBucket,
    uploadObject,
    getObjectBuffer,
    deleteObject,
    getPresignedDownloadUrl,
  };
}
