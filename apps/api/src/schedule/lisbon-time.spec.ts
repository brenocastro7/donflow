import {
  dayOfWeekForDate,
  lisbonDateMinuteToUtc,
  utcToLisbonDateMinute,
} from './lisbon-time';
import { DayOfWeek } from '@prisma/client';

describe('Lisbon time utilities', () => {
  it('applies winter and daylight-saving offsets', () => {
    expect(lisbonDateMinuteToUtc('2026-01-12', 540).toISOString()).toBe(
      '2026-01-12T09:00:00.000Z',
    );
    expect(lisbonDateMinuteToUtc('2026-07-13', 540).toISOString()).toBe(
      '2026-07-13T08:00:00.000Z',
    );
  });

  it('derives local day and minute from UTC', () => {
    expect(dayOfWeekForDate('2026-07-13')).toBe(DayOfWeek.MONDAY);
    expect(utcToLisbonDateMinute(new Date('2026-07-13T08:30:00.000Z'))).toEqual(
      {
        date: '2026-07-13',
        dayOfWeek: DayOfWeek.MONDAY,
        minute: 570,
      },
    );
  });
});
