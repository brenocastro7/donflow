export type CalendarEventInput = {
  uid: string;
  title: string;
  description: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
};

export function formatIcsDateUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function buildAppointmentIcs(event: CalendarEventInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DonFlow//Appointments//PT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${formatIcsDateUtc(new Date().toISOString())}`,
    `DTSTART:${formatIcsDateUtc(event.startsAt)}`,
    `DTEND:${formatIcsDateUtc(event.endsAt)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

export function downloadIcsFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function buildGoogleCalendarUrl(event: CalendarEventInput): string {
  const search = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatIcsDateUtc(event.startsAt)}/${formatIcsDateUtc(event.endsAt)}`,
    details: event.description,
  });
  if (event.location) search.set('location', event.location);
  return `https://calendar.google.com/calendar/render?${search.toString()}`;
}

export function buildOutlookCalendarUrl(event: CalendarEventInput): string {
  const search = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: new Date(event.startsAt).toISOString(),
    enddt: new Date(event.endsAt).toISOString(),
    body: event.description,
  });
  if (event.location) search.set('location', event.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${search.toString()}`;
}
