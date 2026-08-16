import { apiRequest } from '@/lib/api/api-client';

export type InAppNotification = {
  id: string;
  appointmentId: string | null;
  type: 'APPOINTMENT_CONFIRMATION' | 'APPOINTMENT_REMINDER' | 'APPOINTMENT_CANCELLATION';
  title: string;
  message: string;
  scheduledAt: string;
  readAt: string | null;
};

export type NotificationsResponse = {
  data: InAppNotification[];
  meta: { unread: number };
};

export function getNotifications(accessToken: string) {
  return apiRequest<NotificationsResponse>('/notifications', { accessToken });
}

export function markNotificationRead(accessToken: string, id: string) {
  return apiRequest<{ message: string }>(`/notifications/${id}/read`, {
    method: 'PATCH',
    accessToken,
  });
}

export function markAllNotificationsRead(accessToken: string) {
  return apiRequest<{ message: string }>('/notifications/read-all', {
    method: 'PATCH',
    accessToken,
  });
}

export function clearNotifications(accessToken: string) {
  return apiRequest<{ message: string }>('/notifications', {
    method: 'DELETE',
    accessToken,
  });
}
