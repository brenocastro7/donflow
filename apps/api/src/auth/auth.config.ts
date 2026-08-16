const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 900;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 86_400;
const DEFAULT_REMEMBERED_REFRESH_TOKEN_TTL_SECONDS = 2_592_000;
const MINIMUM_SECRET_LENGTH = 32;

export interface AccessTokenConfig {
  secret: string;
  ttlSeconds: number;
  refreshTtlSeconds: number;
  rememberedRefreshTtlSeconds: number;
}

export function getAccessTokenConfig(): AccessTokenConfig {
  const secret = process.env.JWT_ACCESS_SECRET;
  const ttlSeconds = Number(
    process.env.JWT_ACCESS_TTL_SECONDS ?? DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
  );
  const refreshTtlSeconds = Number(
    process.env.AUTH_REFRESH_TTL_SECONDS ?? DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
  );
  const rememberedRefreshTtlSeconds = Number(
    process.env.AUTH_REMEMBER_REFRESH_TTL_SECONDS ??
      DEFAULT_REMEMBERED_REFRESH_TOKEN_TTL_SECONDS,
  );

  if (!secret || secret.length < MINIMUM_SECRET_LENGTH) {
    throw new Error(
      `JWT_ACCESS_SECRET must contain at least ${MINIMUM_SECRET_LENGTH} characters`,
    );
  }

  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error('JWT_ACCESS_TTL_SECONDS must be a positive integer');
  }

  if (!Number.isInteger(refreshTtlSeconds) || refreshTtlSeconds <= 0) {
    throw new Error('AUTH_REFRESH_TTL_SECONDS must be a positive integer');
  }
  if (
    !Number.isInteger(rememberedRefreshTtlSeconds) ||
    rememberedRefreshTtlSeconds <= 0
  ) {
    throw new Error(
      'AUTH_REMEMBER_REFRESH_TTL_SECONDS must be a positive integer',
    );
  }

  return {
    secret,
    ttlSeconds,
    refreshTtlSeconds,
    rememberedRefreshTtlSeconds,
  };
}
