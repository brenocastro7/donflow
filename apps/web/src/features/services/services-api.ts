import type { BarberService } from '../appointments/appointments-api';
import { apiRequest } from '@/lib/api/api-client';

type DataResponse<T> = { data: T };

export type MasterCatalogService = Pick<
  BarberService,
  'id' | 'name' | 'description' | 'durationMinutes' | 'price'
>;

export function getOwnServices(accessToken: string, barberProfileId: string) {
  return apiRequest<DataResponse<BarberService[]>>(
    `/barbers/${barberProfileId}/services?includeInactive=true`,
    { accessToken },
  );
}

export function getMasterServiceCatalog(accessToken: string) {
  return apiRequest<DataResponse<MasterCatalogService[]>>('/master-service-catalog', {
    accessToken,
  });
}

export function createOwnService(
  accessToken: string,
  input: {
    barberProfileId: string;
    sourceBarberServiceId?: string;
    name?: string;
    durationMinutes?: number;
    price?: number;
  },
) {
  return apiRequest<DataResponse<BarberService>>('/barber-services', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export function updateOwnService(
  accessToken: string,
  serviceId: string,
  input: {
    name: string;
    durationMinutes: number;
    price: number;
    isActive: boolean;
  },
) {
  return apiRequest<DataResponse<BarberService>>(`/barber-services/${serviceId}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export function deleteOwnService(accessToken: string, serviceId: string) {
  return apiRequest<DataResponse<{ id: string }>>(`/barber-services/${serviceId}`, {
    method: 'DELETE',
    accessToken,
  });
}
