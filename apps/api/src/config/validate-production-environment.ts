export function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const required = [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'MFA_ENCRYPTION_KEY',
    'APP_PUBLIC_URL',
    'APP_CORS_ORIGINS',
    'EMAIL_API_KEY',
    'EMAIL_FROM_ADDRESS',
    'STORAGE_PROVIDER',
    'STORAGE_ACCOUNT_ID',
    'STORAGE_ACCESS_KEY_ID',
    'STORAGE_SECRET_ACCESS_KEY',
    'STORAGE_BUCKET_NAME',
    'STORAGE_ENDPOINT',
  ];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length)
    throw new Error(`Missing production configuration: ${missing.join(', ')}`);
  if (!process.env.APP_PUBLIC_URL!.startsWith('https://')) {
    throw new Error('APP_PUBLIC_URL must use HTTPS in production');
  }
  if (
    process.env
      .APP_CORS_ORIGINS!.split(',')
      .some((origin) => !origin.trim().startsWith('https://'))
  ) {
    throw new Error('Every production CORS origin must use HTTPS');
  }
  if (process.env.ENABLE_API_DOCS === 'true') {
    throw new Error('API documentation must remain disabled in production');
  }
  if (process.env.STORAGE_PROVIDER !== 'r2') {
    throw new Error('STORAGE_PROVIDER must be r2 in production');
  }
  if (!process.env.STORAGE_ENDPOINT!.startsWith('https://')) {
    throw new Error('STORAGE_ENDPOINT must use HTTPS in production');
  }
}
