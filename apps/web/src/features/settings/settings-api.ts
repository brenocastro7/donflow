import { apiRequest } from '@/lib/api/api-client';

export type DayOfWeek =
  'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type BusinessHour = {
  id?: string;
  dayOfWeek: DayOfWeek;
  startMinute: number;
  endMinute: number;
};
export type ScheduleBlock = { id: string; startsAt: string; endsAt: string; reason: string | null };
type AccountSettings = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  pendingEmail: string | null;
  emailConfirmationPending: boolean;
};

export function getAccountSettings(token: string) {
  return apiRequest<{
    data: AccountSettings;
  }>('/settings/account', { accessToken: token });
}
export function updateAccountSettings(
  token: string,
  input: { name?: string; email?: string; phone?: string; currentPassword?: string },
) {
  return apiRequest<{
    data: AccountSettings;
  }>('/settings/account', { method: 'PATCH', accessToken: token, body: input });
}
export function getShopSettings(token: string) {
  return apiRequest<{ data: { address: string | null; businessHours: BusinessHour[] } }>(
    '/settings/shop',
    { accessToken: token },
  );
}
function updateShopSettings(
  token: string,
  input: { address?: string; businessHours?: BusinessHour[] },
) {
  return apiRequest<{ data: { address: string | null; businessHours: BusinessHour[] } }>(
    '/settings/shop',
    {
      method: 'PATCH',
      accessToken: token,
      body: {
        ...input,
        ...(input.businessHours
          ? {
              businessHours: input.businessHours.map(({ dayOfWeek, startMinute, endMinute }) => ({
                dayOfWeek,
                startMinute,
                endMinute,
              })),
            }
          : {}),
      },
    },
  );
}
export function updateShopAddress(token: string, address: string) {
  return updateShopSettings(token, { address });
}
export function updateShopHours(token: string, businessHours: BusinessHour[]) {
  return updateShopSettings(token, { businessHours });
}
export function getBusinessHours(token: string, profileId: string) {
  return apiRequest<{ data: BusinessHour[] }>(`/barbers/${profileId}/business-hours`, {
    accessToken: token,
  });
}
export function updateBusinessHours(token: string, profileId: string, hours: BusinessHour[]) {
  return apiRequest<{ data: BusinessHour[] }>(`/barbers/${profileId}/business-hours`, {
    method: 'PUT',
    accessToken: token,
    body: {
      hours: hours.map(({ dayOfWeek, startMinute, endMinute }) => ({
        dayOfWeek,
        startMinute,
        endMinute,
      })),
    },
  });
}
export function getScheduleBlocks(token: string, profileId: string) {
  return apiRequest<{ data: ScheduleBlock[] }>(`/barbers/${profileId}/schedule-blocks`, {
    accessToken: token,
  });
}
export function createScheduleBlock(
  token: string,
  profileId: string,
  input: { startsAt: string; endsAt: string; reason?: string },
) {
  return apiRequest<{ data: ScheduleBlock }>(`/barbers/${profileId}/schedule-blocks`, {
    method: 'POST',
    accessToken: token,
    body: input,
  });
}
export function deleteScheduleBlock(token: string, id: string) {
  return apiRequest<{ message: string }>(`/schedule-blocks/${id}`, {
    method: 'DELETE',
    accessToken: token,
  });
}
