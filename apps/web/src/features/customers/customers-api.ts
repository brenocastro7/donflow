import { apiRequest } from '@/lib/api/api-client';

export type CustomerSummary = {
  id: string;
  name: string;
  phone: string | null;
  profileImageDataUrl: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  lastVisit: string | null;
  totalSpent: string | number;
  _count: { customerAppointments: number };
  customerBookingBlocked?: boolean;
  customerBookingLimited?: boolean;
};

export type CustomerListResponse = {
  data: CustomerSummary[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  summary: {
    totalCustomers: number;
    activeCustomers: number;
    newCustomers: number;
    averageTicket: number;
  };
};

export type CustomerAppointment = {
  id: string;
  startsAt: string;
  serviceNameSnapshot: string;
  priceSnapshot: string | number;
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  barberProfile: { displayName: string };
};

export function getCustomers(
  accessToken: string,
  search: string,
  page: number,
  pageSize = 5,
) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search.trim()) params.set('search', search.trim());
  return apiRequest<CustomerListResponse>(`/customers?${params}`, { accessToken });
}

export function lookupCustomersByPhone(accessToken: string, phone: string) {
  const params = new URLSearchParams({ phone });
  return apiRequest<{
    data: Array<Pick<CustomerSummary, 'id' | 'name' | 'phone' | 'profileImageDataUrl'>>;
  }>(`/customers/lookup?${params}`, { accessToken });
}

export function updateCustomerBookingBlock(
  accessToken: string,
  customerId: string,
  blocked: boolean,
) {
  return apiRequest<{
    data: {
      id: string;
      customerBookingBlocked: boolean;
      customerBookingLimited: boolean;
    };
  }>(`/customers/${customerId}/booking-block`, {
    method: 'PATCH',
    accessToken,
    body: { blocked },
  });
}

export function getCustomer(accessToken: string, customerId: string) {
  return apiRequest<{ data: CustomerSummary }>(`/customers/${customerId}`, { accessToken });
}

export function getCustomerAppointments(accessToken: string, customerId: string) {
  return apiRequest<{ data: CustomerAppointment[] }>(
    `/customers/${customerId}/appointments?page=1&pageSize=100`,
    { accessToken },
  );
}
