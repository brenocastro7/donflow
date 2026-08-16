import { z } from 'zod';

const environmentSchema = z.object({
  VITE_API_URL: z
    .string()
    .refine((value) => value.startsWith('/') || URL.canParse(value), {
      message: 'VITE_API_URL must be an absolute URL or a root-relative path.',
    })
    .default('/api'),
  VITE_SENTRY_DSN: z.string().optional(),
});

export const environment = environmentSchema.parse(import.meta.env);
