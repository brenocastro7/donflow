import { DayOfWeek } from '@prisma/client';

const TIME_ZONE = 'Europe/Lisbon';
const DAYS: DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

export function parseLocalDate(date: string): {
  year: number;
  month: number;
  day: number;
} {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Date must use YYYY-MM-DD');
  }
  const [year, month, day] = date.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new Error('Date is invalid');
  }
  return { year, month, day };
}

export function dayOfWeekForDate(date: string): DayOfWeek {
  const { year, month, day } = parseLocalDate(date);
  return DAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

export function lisbonDateMinuteToUtc(date: string, minute: number): Date {
  const { year, month, day } = parseLocalDate(date);
  const hour = Math.floor(minute / 60);
  const minuteOfHour = minute % 60;
  let timestamp = Date.UTC(year, month - 1, day, hour, minuteOfHour);

  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(timestamp));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    const representedAsUtc = Date.UTC(
      value('year'),
      value('month') - 1,
      value('day'),
      value('hour'),
      value('minute'),
    );
    timestamp -=
      representedAsUtc - Date.UTC(year, month - 1, day, hour, minuteOfHour);
  }
  return new Date(timestamp);
}

export function utcToLisbonDateMinute(value: Date): {
  date: string;
  dayOfWeek: DayOfWeek;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  return {
    date,
    dayOfWeek: dayOfWeekForDate(date),
    minute: Number(part('hour')) * 60 + Number(part('minute')),
  };
}
