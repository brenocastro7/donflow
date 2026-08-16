import { apiRequest } from '@/lib/api/api-client';

export type CustomerReview = {
  id: string;
  appointmentId: string;
  rating: number;
  comment: string | null;
};

export function getMyReviews(accessToken: string) {
  return apiRequest<{ data: CustomerReview[] }>('/reviews/me', { accessToken });
}

export function createReview(
  accessToken: string,
  input: { appointmentId: string; rating: number; comment?: string },
) {
  return apiRequest<{ data: CustomerReview }>('/reviews', {
    method: 'POST',
    accessToken,
    body: input,
  });
}
