import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route (or an entire controller) out of the global JwtAuthGuard.
 * Every route that must stay reachable without an authenticated session
 * needs this decorator; anything without it is denied by default.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
