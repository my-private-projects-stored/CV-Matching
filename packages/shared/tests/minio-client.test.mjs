import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PRESIGNED_TTL_SECONDS,
  MINIO_BUCKETS,
  createMinioStorage,
} from "../src/storage/minio-client.js";

test("createMinioStorage uploads private objects and generates 15-minute Presigned URLs", async () => {
  const calls = [];
  const fakeClient = {
    async bucketExists(bucket) {
      calls.push(["bucketExists", bucket]);
      return false;
    },
    async makeBucket(bucket) {
      calls.push(["makeBucket", bucket]);
    },
    async putObject(bucket, key, buf, size, meta) {
      calls.push(["putObject", bucket, key, size, meta]);
    },
    async presignedGetObject(bucket, key, ttl) {
      calls.push(["presignedGetObject", bucket, key, ttl]);
      return `http://minio:9000/${bucket}/${key}?X-Amz-Expires=${ttl}`;
    },
  };

  const storage = createMinioStorage({}, fakeClient);
  const res = await storage.uploadObject({
    bucket: MINIO_BUCKETS.RESUMES,
    objectKey: "cand-1/resume-1.pdf",
    buffer: Buffer.from("%PDF-1.7"),
    contentType: "application/pdf",
  });

  assert.equal(res.bucket, "resumes-bucket");
  assert.equal(res.objectKey, "cand-1/resume-1.pdf");
  assert.equal(res.size, 8);

  const url = await storage.getPresignedDownloadUrl(MINIO_BUCKETS.RESUMES, "cand-1/resume-1.pdf");
  assert.match(url, /X-Amz-Expires=900/);
  assert.equal(DEFAULT_PRESIGNED_TTL_SECONDS, 900);
  assert.equal(calls[1][0], "makeBucket");
});
