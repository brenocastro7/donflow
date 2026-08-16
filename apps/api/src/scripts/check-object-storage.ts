import '../config/load-environment';
import { R2ObjectStorageService } from '../storage/r2-object-storage.service';

async function check(): Promise<void> {
  if (process.env.STORAGE_PROVIDER !== 'r2') {
    throw new Error('STORAGE_PROVIDER must be r2 to check object storage');
  }
  await new R2ObjectStorageService().ping();
  console.log('R2 connection verified.');
}

void check().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  const details = error as {
    code?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const diagnostic = [
    errorName,
    details.code ?? details.Code,
    details.$metadata?.httpStatusCode,
  ]
    .filter((value) => value !== undefined)
    .join(':');
  console.error(`R2 connection check failed (${diagnostic}).`);
  process.exitCode = 1;
});
