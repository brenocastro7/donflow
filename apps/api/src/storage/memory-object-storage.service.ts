import { Injectable } from '@nestjs/common';
import type { ObjectStorage, StoredObject } from './object-storage';

@Injectable()
export class MemoryObjectStorageService implements ObjectStorage {
  private readonly objects = new Map<string, StoredObject>();
  put(key: string, body: Buffer, contentType: string) {
    this.objects.set(key, { body: Buffer.from(body), contentType });
    return Promise.resolve();
  }
  get(key: string) {
    return Promise.resolve(this.objects.get(key) ?? null);
  }
  delete(key: string) {
    this.objects.delete(key);
    return Promise.resolve();
  }
  ping() {
    return Promise.resolve();
  }
}
