export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export type StoredObject = {
  body: Buffer;
  contentType: string;
  etag?: string;
};

export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  ping(): Promise<void>;
}
