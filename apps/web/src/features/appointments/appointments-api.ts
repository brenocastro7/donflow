import { apiRequest } from '@/lib/api/api-client';
import { getAccessToken } from '../auth/auth-session';

export type AppointmentStatus = 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
export type CalendarView = 'day' | 'week' | 'month';

export type Barber = {
  id: string;
  displayName: string;
  user: {
    id: string;
    name: string;
    role: 'BARBER' | 'MASTER';
    status: string;
    profileImageDataUrl: string | null;
  };
};

export type BarberService = {
  id: string;
  barberProfileId: string;
  sourceBarberServiceId: string | null;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string;
  isActive: boolean;
};

export type AvailabilitySlot = {
  startsAt: string;
  endsAt: string;
};

export type AvailabilityCalendarDay = {
  date: string;
  availableSlots: number;
  isOpen: boolean;
};

export type CalendarAppointment = {
  id: string;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    profileImageDataUrl: string | null;
  } | null;
  localCustomerName: string | null;
  localCustomerPhone: string | null;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  serviceNameSnapshot: string;
  durationSnapshot: number;
  barberProfile: {
    id: string;
    displayName: string;
    user: {
      name: string;
      status: string;
    };
  };
};

export type AppointmentDetail = CalendarAppointment & {
  notes: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  autoCompletedAt: string | null;
  noShowJustification: string | null;
  barberService: {
    id: string;
    isActive: boolean;
  };
};

export function updateAppointmentStatus(
  accessToken: string,
  appointmentId: string,
  status: 'COMPLETED' | 'NO_SHOW',
  justification?: string,
) {
  return apiRequest<DataResponse<AppointmentDetail>>(`/appointments/${appointmentId}/status`, {
    method: 'PATCH',
    accessToken,
    body: { status, justification: justification?.trim() || undefined },
  });
}

type AppointmentCalendarResponse = {
  data: CalendarAppointment[];
  meta: {
    total: number;
    timeZone: 'Europe/Lisbon';
  };
};

type DataResponse<T> = { data: T };

export function getStoredAccessToken(): string | null {
  return getAccessToken();
}

export function getAppointmentCalendar(
  accessToken: string,
  view: CalendarView,
  date: string,
  barberProfileId?: string,
): Promise<AppointmentCalendarResponse> {
  const search = new URLSearchParams({
    view,
    date,
    page: '1',
    pageSize: '100',
  });
  if (barberProfileId) {
    search.set('barberProfileId', barberProfileId);
  }

  return apiRequest<AppointmentCalendarResponse>(`/appointments?${search.toString()}`, {
    accessToken,
  });
}

export function getAppointmentDetail(accessToken: string, appointmentId: string) {
  return apiRequest<DataResponse<AppointmentDetail>>(`/appointments/${appointmentId}`, {
    accessToken,
  });
}

export function getMyAppointments(accessToken: string, scope: 'upcoming' | 'history') {
  return apiRequest<{
    data: Array<{
      id: string;
      startsAt: string;
      endsAt: string;
      status: AppointmentStatus;
      barberServiceId: string;
      serviceNameSnapshot: string;
      durationSnapshot: number;
      priceSnapshot: string;
      barberProfile: { id: string; displayName: string };
    }>;
    meta: { total: number };
  }>(`/appointments/mine?scope=${scope}&page=1&pageSize=100`, { accessToken });
}

export function cancelAppointment(accessToken: string, appointmentId: string, reason?: string) {
  return apiRequest<DataResponse<CalendarAppointment>>(`/appointments/${appointmentId}/cancel`, {
    method: 'PATCH',
    accessToken,
    body: { reason: reason?.trim() || undefined },
  });
}

export function rescheduleAppointment(
  accessToken: string,
  appointmentId: string,
  startsAt: string,
) {
  return apiRequest<DataResponse<CalendarAppointment>>(
    `/appointments/${appointmentId}/reschedule`,
    {
      method: 'PATCH',
      accessToken,
      body: { startsAt },
    },
  );
}

export function getBarbers(accessToken: string) {
  return apiRequest<DataResponse<Barber[]>>('/barbers', { accessToken });
}

export function getBarberServices(accessToken: string, barberProfileId: string) {
  return apiRequest<DataResponse<BarberService[]>>(`/barbers/${barberProfileId}/services`, {
    accessToken,
  });
}

export function getAvailability(
  accessToken: string,
  barberProfileId: string,
  barberServiceId: string,
  date: string,
) {
  const search = new URLSearchParams({
    barberProfileId,
    barberServiceId,
    date,
    slotInterval: '15',
  });
  return apiRequest<
    DataResponse<{
      date: string;
      timeZone: 'Europe/Lisbon';
      barberProfileId: string;
      barberServiceId: string;
      slots: AvailabilitySlot[];
    }>
  >(`/availability?${search.toString()}`, { accessToken });
}

export function getAvailabilityCalendar(
  accessToken: string,
  barberProfileId: string,
  barberServiceId: string,
  month: string,
) {
  const search = new URLSearchParams({
    barberProfileId,
    barberServiceId,
    month,
    slotInterval: '15',
  });
  return apiRequest<
    DataResponse<{
      month: string;
      timeZone: 'Europe/Lisbon';
      barberProfileId: string;
      barberServiceId: string;
      days: AvailabilityCalendarDay[];
    }>
  >(`/availability/calendar?${search.toString()}`, { accessToken });
}

export function createAppointment(
  accessToken: string,
  input: {
    barberServiceId: string;
    startsAt: string;
    customerName?: string;
    customerPhone?: string;
    notes?: string;
  },
) {
  return apiRequest<DataResponse<CalendarAppointment>>('/appointments', {
    method: 'POST',
    accessToken,
    body: input,
  });
}
