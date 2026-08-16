import { Module } from '@nestjs/common';
import { MemoryObjectStorageService } from './memory-object-storage.service';
import { OBJECT_STORAGE } from './object-storage';
import { R2ObjectStorageService } from './r2-object-storage.service';

function storageProvider() {
  const provider = process.env.STORAGE_PROVIDER?.trim().toLowerCase();
  if (provider === 'r2') return R2ObjectStorageService;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('STORAGE_PROVIDER must be r2 in production');
  }
  return MemoryObjectStorageService;
}

@Module({
  providers: [{ provide: OBJECT_STORAGE, useClass: storageProvider() }],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
