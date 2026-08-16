import { apiRequest } from '@/lib/api/api-client';

export type DashboardMetrics = {
  appointments: number;
  completed: number;
  cancelled: number;
  customers: number;
  realizedRevenue: number;
  averageTicket: number;
  occupiedMinutes: number;
  occupancyPercent: number;
  ratingAverage: number | null;
  ratingCount: number;
  noShows: number;
  noShowRate: number;
};
export type DashboardResponse = {
  data: {
    periods: Record<'day' | 'week' | 'month', DashboardPeriod>;
    report: {
      month: string;
      days: DashboardSeriesPoint[];
    } & DashboardPeriod;
    ratings: {
      metrics: Pick<DashboardMetrics, 'ratingAverage' | 'ratingCount'>;
      reviews: BarberRating[];
    };
  };
};
export type DashboardSeriesPoint = { date: string; appointments: number };
export type BarberRating = {
  barberProfileId: string;
  name: string;
  profileImageDataUrl: string | null;
  ratingAverage: number | null;
  ratingCount: number;
};
export type DashboardPeriod = {
  metrics: DashboardMetrics;
  series: DashboardSeriesPoint[];
  reviews: BarberRating[];
  previousMetrics: DashboardMetrics;
};
export type DashboardScope = 'own' | 'general';

export function getDashboard(token: string, month: string, scope?: DashboardScope) {
  const query = new URLSearchParams({ month });
  if (scope) query.set('scope', scope);
  return apiRequest<DashboardResponse>(`/dashboard?${query.toString()}`, { accessToken: token });
}
