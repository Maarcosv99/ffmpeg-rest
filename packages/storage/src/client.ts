import { S3Client } from "@aws-sdk/client-s3";

export type StorageConfig = {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  publicUrl: string;
};

export function createStorageClient(config: StorageConfig): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: true,
  });
}
