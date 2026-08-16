import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { ObjectStorage, StoredObject } from './object-storage';

@Injectable()
export class R2ObjectStorageService implements ObjectStorage {
  private readonly bucket = process.env.STORAGE_BUCKET_NAME!.trim();
  private readonly client = new S3Client({
    region: 'auto',
    endpoint: process.env.STORAGE_ENDPOINT!.trim().replace(/\/$/, ''),
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!.trim(),
    },
  });

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'private, max-age=3600',
      }),
    );
  }

  async get(key: string): Promise<StoredObject | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!result.Body) return null;
      return {
        body: Buffer.from(await result.Body.transformToByteArray()),
        contentType: result.ContentType ?? 'application/octet-stream',
        etag: result.ETag,
      };
    } catch (error) {
      if (
        error instanceof NoSuchKey ||
        (error as { name?: string }).name === 'NoSuchKey'
      ) {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }
}
