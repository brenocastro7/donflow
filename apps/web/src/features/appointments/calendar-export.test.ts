import { describe, expect, it } from 'vitest';
import {
  buildAppointmentIcs,
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
  escapeIcsText,
  formatIcsDateUtc,
  type CalendarEventInput,
} from './calendar-export';

const event: CalendarEventInput = {
  uid: 'appointment-123@donflow.example',
  title: 'Corte de cabelo',
  description: 'Com João, Corte de cabelo',
  location: 'Rua Exemplo, 123, Lisboa',
  startsAt: '2026-09-01T09:00:00.000Z',
  endsAt: '2026-09-01T09:30:00.000Z',
};

describe('formatIcsDateUtc', () => {
  it('formats an ISO instant as RFC 5545 UTC form', () => {
    expect(formatIcsDateUtc('2026-09-01T09:00:00.000Z')).toBe('20260901T090000Z');
  });
});

describe('escapeIcsText', () => {
  it('escapes commas, semicolons, backslashes and newlines', () => {
    expect(escapeIcsText('Corte, barba; extra\\nota\nlinha2')).toBe(
      'Corte\\, barba\\; extra\\\\nota\\nlinha2',
    );
  });
});

describe('buildAppointmentIcs', () => {
  it('produces a VEVENT with the expected fields', () => {
    const ics = buildAppointmentIcs(event);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain(`UID:${event.uid}`);
    expect(ics).toContain('DTSTART:20260901T090000Z');
    expect(ics).toContain('DTEND:20260901T093000Z');
    expect(ics).toContain('SUMMARY:Corte de cabelo');
    expect(ics).toContain('LOCATION:Rua Exemplo\\, 123\\, Lisboa');
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('omits LOCATION when no address is available', () => {
    const ics = buildAppointmentIcs({ ...event, location: null });
    expect(ics).not.toContain('LOCATION:');
  });
});

describe('buildGoogleCalendarUrl', () => {
  it('builds a Google Calendar template URL with encoded params', () => {
    const url = buildGoogleCalendarUrl(event);
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE');
    expect(parsed.searchParams.get('text')).toBe('Corte de cabelo');
    expect(parsed.searchParams.get('dates')).toBe('20260901T090000Z/20260901T093000Z');
    expect(parsed.searchParams.get('location')).toBe('Rua Exemplo, 123, Lisboa');
  });

  it('omits location param when address is unavailable', () => {
    const url = buildGoogleCalendarUrl({ ...event, location: null });
    expect(new URL(url).searchParams.has('location')).toBe(false);
  });
});

describe('buildOutlookCalendarUrl', () => {
  it('builds an Outlook deeplink compose URL with encoded params', () => {
    const url = buildOutlookCalendarUrl(event);
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      'https://outlook.live.com/calendar/0/deeplink/compose',
    );
    expect(parsed.searchParams.get('subject')).toBe('Corte de cabelo');
    expect(parsed.searchParams.get('startdt')).toBe('2026-09-01T09:00:00.000Z');
    expect(parsed.searchParams.get('enddt')).toBe('2026-09-01T09:30:00.000Z');
    expect(parsed.searchParams.get('location')).toBe('Rua Exemplo, 123, Lisboa');
  });
});
