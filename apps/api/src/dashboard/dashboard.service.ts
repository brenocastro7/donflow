import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AppointmentStatus, DayOfWeek, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { lisbonDateMinuteToUtc } from '../schedule/lisbon-time';
import { profileImageDataUrl } from '../users/profile-image-url';

type ProfileImageUser = {
  id: string;
  name: string;
  profileImage: Uint8Array | null;
  profileImageMimeType: string | null;
  profileImageKey: string | null;
  updatedAt: Date;
};

type MetricAppointment = {
  id: string;
  startsAt: Date;
  status: AppointmentStatus;
  priceSnapshot: Prisma.Decimal;
  durationSnapshot: number;
  customerUserId: string | null;
  localCustomerPhone: string | null;
};

type MetricReview = {
  rating: number;
  appointment: {
    barberProfile: {
      id: string;
      displayName: string | null;
      user: ProfileImageUser;
    };
  };
};

type RatingProfile = {
  id: string;
  displayName: string | null;
  user: ProfileImageUser;
};

@Injectable()
export class DashboardService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DashboardService.name);
  private snapshotInterval?: NodeJS.Timeout;
  private closingSnapshots = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.snapshotInterval = setInterval(
      () => void this.closeMissingMonths(),
      60 * 60 * 1000,
    );
    this.snapshotInterval.unref();
    setTimeout(() => void this.closeMissingMonths(), 2_000).unref();
  }

  onModuleDestroy(): void {
    if (this.snapshotInterval) clearInterval(this.snapshotInterval);
  }

  async get(
    user: AuthenticatedUser,
    selectedMonth?: string,
    requestedScope?: 'own' | 'general',
  ) {
    const today = this.lisbonDate(new Date());
    const month = selectedMonth ?? today.slice(0, 7);
    const weekStart = this.weekStart(today);
    const currentMonth = today.slice(0, 7);
    const ranges = {
      day: { start: today, end: this.addDays(today, 1) },
      previousDay: { start: this.addDays(today, -1), end: today },
      week: { start: weekStart, end: this.addDays(weekStart, 7) },
      previousWeek: { start: this.addDays(weekStart, -7), end: weekStart },
      month: this.monthDates(currentMonth),
      report: this.monthDates(month),
      previousReport: this.monthDates(this.previousMonth(month)),
    };
    // A BARBER is always scoped to their own agenda. A MASTER sees the
    // whole shop by default and only narrows to their own agenda when
    // explicitly requested (requestedScope === 'own').
    const scope: Prisma.AppointmentWhereInput =
      user.role === 'MASTER' && requestedScope !== 'own'
        ? {}
        : { barberProfileId: user.barberProfileId ?? '' };
    const scopedBarberId =
      typeof scope.barberProfileId === 'string' ? scope.barberProfileId : null;

    const [
      day,
      week,
      currentMonthItems,
      reportItems,
      dayReviews,
      weekReviews,
      monthReviews,
      reportReviews,
      ratingProfiles,
      previousDay,
      previousWeek,
      previousReport,
      allReviews,
    ] = await Promise.all([
      this.appointments(scope, ranges.day),
      this.appointments(scope, ranges.week),
      this.appointments(scope, ranges.month),
      this.appointments(scope, ranges.report),
      this.reviews(scope, ranges.day),
      this.reviews(scope, ranges.week),
      this.reviews(scope, ranges.month),
      this.reviews(scope, ranges.report),
      this.ratingProfiles(),
      this.appointments(scope, ranges.previousDay),
      this.appointments(scope, ranges.previousWeek),
      this.appointments(scope, ranges.previousReport),
      this.reviews(scope),
    ]);
    // When scoped to one agenda, never mix in other barbers' identities —
    // the breakdown must contain at most the current agenda's own entry.
    const profilesForBreakdown = scopedBarberId
      ? ratingProfiles.filter((profile) => profile.id === scopedBarberId)
      : ratingProfiles;
    const [
      dayCapacity,
      weekCapacity,
      monthCapacity,
      reportCapacity,
      previousDayCapacity,
      previousWeekCapacity,
      previousReportCapacity,
    ] = await Promise.all([
      this.capacity(scope, ranges.day),
      this.capacity(scope, ranges.week),
      this.capacity(scope, ranges.month),
      this.capacity(scope, ranges.report),
      this.capacity(scope, ranges.previousDay),
      this.capacity(scope, ranges.previousWeek),
      this.capacity(scope, ranges.previousReport),
    ]);

    const liveReport = this.reportData(
      month,
      reportItems,
      reportReviews,
      profilesForBreakdown,
      reportCapacity,
      ranges.report,
      previousReport,
      previousReportCapacity,
    );
    const selectedReport =
      month < currentMonth
        ? await this.getOrCreateSnapshot(
            month,
            this.scopeKey(scope),
            scope,
            liveReport,
          )
        : liveReport;

    return {
      data: {
        periods: {
          day: this.period(
            day,
            dayReviews,
            profilesForBreakdown,
            dayCapacity,
            ranges.day,
            previousDay,
            previousDayCapacity,
          ),
          week: this.period(
            week,
            weekReviews,
            profilesForBreakdown,
            weekCapacity,
            ranges.week,
            previousWeek,
            previousWeekCapacity,
          ),
          month: this.period(
            currentMonthItems,
            monthReviews,
            profilesForBreakdown,
            monthCapacity,
            ranges.month,
          ),
        },
        report: selectedReport,
        ratings: {
          metrics: this.ratingMetrics(allReviews),
          reviews: this.reviewBreakdown(allReviews, profilesForBreakdown),
        },
      },
    };
  }

  private reportData(
    month: string,
    appointments: MetricAppointment[],
    reviews: MetricReview[],
    ratingProfiles: RatingProfile[],
    capacityMinutes: number,
    dates: { start: string; end: string },
    previousAppointments: MetricAppointment[] = [],
    previousCapacityMinutes = 0,
  ) {
    return {
      month,
      ...this.period(
        appointments,
        reviews,
        ratingProfiles,
        capacityMinutes,
        dates,
      ),
      previousMetrics: this.metrics(
        previousAppointments,
        [],
        previousCapacityMinutes,
      ),
      days: this.dailyBreakdown(appointments, month),
    };
  }

  private scopeKey(scope: Prisma.AppointmentWhereInput) {
    return typeof scope.barberProfileId === 'string'
      ? `BARBER:${scope.barberProfileId}`
      : 'MASTER';
  }

  private async getOrCreateSnapshot(
    month: string,
    scopeKey: string,
    scope: Prisma.AppointmentWhereInput,
    fallback?: ReturnType<DashboardService['reportData']>,
  ) {
    const existing = await this.prisma.monthlyDashboardSnapshot.findUnique({
      where: { month_scopeKey: { month, scopeKey } },
      select: { data: true },
    });
    if (existing) {
      const stored = existing.data as unknown as ReturnType<
        DashboardService['reportData']
      >;
      return stored.previousMetrics || !fallback
        ? stored
        : { ...stored, previousMetrics: fallback.previousMetrics };
    }
    const data = fallback ?? (await this.buildMonthlyReport(month, scope));
    try {
      await this.prisma.monthlyDashboardSnapshot.create({
        data: { month, scopeKey, data },
      });
    } catch (error) {
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )) {
        throw error;
      }
    }
    return data;
  }

  private async buildMonthlyReport(
    month: string,
    scope: Prisma.AppointmentWhereInput,
  ) {
    const dates = this.monthDates(month);
    const previousDates = this.monthDates(this.previousMonth(month));
    const [
      appointments,
      reviews,
      profiles,
      capacity,
      previousAppointments,
      previousCapacity,
    ] = await Promise.all([
      this.appointments(scope, dates),
      this.reviews(scope, dates),
      this.ratingProfiles(),
      this.capacity(scope, dates),
      this.appointments(scope, previousDates),
      this.capacity(scope, previousDates),
    ]);
    const scopedBarberId =
      typeof scope.barberProfileId === 'string' ? scope.barberProfileId : null;
    const profilesForBreakdown = scopedBarberId
      ? profiles.filter((profile) => profile.id === scopedBarberId)
      : profiles;
    return this.reportData(
      month,
      appointments,
      reviews,
      profilesForBreakdown,
      capacity,
      dates,
      previousAppointments,
      previousCapacity,
    );
  }

  private async closeMissingMonths() {
    if (this.closingSnapshots) return;
    this.closingSnapshots = true;
    try {
      const currentMonth = this.lisbonDate(new Date()).slice(0, 7);
      const earliest = await this.prisma.appointment.findFirst({
        orderBy: { startsAt: 'asc' },
        select: { startsAt: true },
      });
      const startMonth = earliest
        ? this.lisbonDate(earliest.startsAt).slice(0, 7)
        : this.previousMonth(currentMonth);
      const profiles = await this.prisma.barberProfile.findMany({
        select: { id: true },
      });
      for (
        let month = startMonth;
        month < currentMonth;
        month = this.nextMonth(month)
      ) {
        await this.getOrCreateSnapshot(month, 'MASTER', {});
        for (const profile of profiles) {
          await this.getOrCreateSnapshot(month, `BARBER:${profile.id}`, {
            barberProfileId: profile.id,
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to close monthly dashboard snapshots', error);
    } finally {
      this.closingSnapshots = false;
    }
  }

  private period(
    appointments: MetricAppointment[],
    reviews: MetricReview[],
    ratingProfiles: RatingProfile[],
    capacityMinutes: number,
    dates: { start: string; end: string },
    previousAppointments: MetricAppointment[] = [],
    previousCapacityMinutes = 0,
  ) {
    return {
      metrics: this.metrics(appointments, reviews, capacityMinutes),
      series: this.series(appointments, dates.start, dates.end),
      reviews: this.reviewBreakdown(reviews, ratingProfiles),
      previousMetrics: this.metrics(
        previousAppointments,
        [],
        previousCapacityMinutes,
      ),
    };
  }

  private ratingProfiles(): Promise<RatingProfile[]> {
    return this.prisma.barberProfile.findMany({
      where: { user: { status: 'ACTIVE' } },
      select: {
        id: true,
        displayName: true,
        user: {
          select: {
            name: true,
            id: true,
            profileImage: true,
            profileImageMimeType: true,
            profileImageKey: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });
  }

  private reviews(
    scope: Prisma.AppointmentWhereInput,
    dates?: { start: string; end: string },
  ) {
    return this.prisma.review.findMany({
      where: {
        ...(dates ? { createdAt: this.range(dates.start, dates.end) } : {}),
        appointment: scope,
      },
      select: {
        rating: true,
        appointment: {
          select: {
            barberProfile: {
              select: {
                id: true,
                displayName: true,
                user: {
                  select: {
                    name: true,
                    id: true,
                    profileImage: true,
                    profileImageMimeType: true,
                    profileImageKey: true,
                    updatedAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  private async capacity(
    scope: Prisma.AppointmentWhereInput,
    dates: { start: string; end: string },
  ) {
    const hours = await this.prisma.businessHour.findMany({
      where:
        typeof scope.barberProfileId === 'string'
          ? { barberProfileId: scope.barberProfileId }
          : {},
      select: { dayOfWeek: true, startMinute: true, endMinute: true },
    });
    let total = 0;
    for (
      let date = dates.start;
      date < dates.end;
      date = this.addDays(date, 1)
    ) {
      const day = this.dayOfWeek(date);
      total += hours
        .filter((hour) => hour.dayOfWeek === day)
        .reduce((sum, hour) => sum + hour.endMinute - hour.startMinute, 0);
    }
    return total;
  }

  private appointments(
    scope: Prisma.AppointmentWhereInput,
    dates: { start: string; end: string },
  ): Promise<MetricAppointment[]> {
    return this.prisma.appointment.findMany({
      where: { ...scope, startsAt: this.range(dates.start, dates.end) },
      select: {
        id: true,
        startsAt: true,
        status: true,
        priceSnapshot: true,
        durationSnapshot: true,
        customerUserId: true,
        localCustomerPhone: true,
      },
    });
  }

  private metrics(
    appointments: MetricAppointment[],
    reviews: MetricReview[],
    capacityMinutes: number,
  ) {
    const completed = appointments.filter(
      (item) => item.status === AppointmentStatus.COMPLETED,
    );
    const cancelled = appointments.filter(
      (item) => item.status === AppointmentStatus.CANCELLED,
    );
    const noShows = appointments.filter(
      (item) => item.status === AppointmentStatus.NO_SHOW,
    );
    const customers = new Set(
      completed.map(
        (item) =>
          item.customerUserId ?? item.localCustomerPhone ?? `local:${item.id}`,
      ),
    );
    const revenue = completed.reduce(
      (sum, item) => sum + Number(item.priceSnapshot),
      0,
    );
    const occupiedMinutes = appointments
      .filter((item) => item.status !== AppointmentStatus.CANCELLED)
      .reduce((sum, item) => sum + item.durationSnapshot, 0);
    const ratingTotal = reviews.reduce((sum, review) => sum + review.rating, 0);
    return {
      appointments: appointments.length,
      completed: completed.length,
      cancelled: cancelled.length,
      customers: customers.size,
      realizedRevenue: revenue,
      averageTicket: completed.length ? revenue / completed.length : 0,
      occupiedMinutes,
      occupancyPercent: capacityMinutes
        ? Math.min(100, Math.round((occupiedMinutes / capacityMinutes) * 100))
        : 0,
      ratingAverage: reviews.length ? ratingTotal / reviews.length : null,
      ratingCount: reviews.length,
      noShows: noShows.length,
      noShowRate:
        completed.length + noShows.length
          ? Math.round(
              (noShows.length / (completed.length + noShows.length)) * 100,
            )
          : 0,
    };
  }

  private ratingMetrics(reviews: MetricReview[]) {
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return {
      ratingAverage: reviews.length ? total / reviews.length : null,
      ratingCount: reviews.length,
    };
  }

  private reviewBreakdown(
    reviews: MetricReview[],
    ratingProfiles: RatingProfile[],
  ) {
    const profiles = new Map<
      string,
      { name: string; image: string | null; total: number; count: number }
    >();
    for (const profile of ratingProfiles) {
      profiles.set(profile.id, {
        name: profile.displayName ?? profile.user.name,
        image: profileImageDataUrl(profile.user),
        total: 0,
        count: 0,
      });
    }
    for (const review of reviews) {
      const profile = review.appointment.barberProfile;
      const current = profiles.get(profile.id) ?? {
        name: profile.displayName ?? profile.user.name,
        image: profileImageDataUrl(profile.user),
        total: 0,
        count: 0,
      };
      current.total += review.rating;
      current.count += 1;
      profiles.set(profile.id, current);
    }
    return [...profiles.entries()]
      .map(([barberProfileId, profile]) => ({
        barberProfileId,
        name: profile.name,
        profileImageDataUrl: profile.image,
        ratingAverage: profile.count ? profile.total / profile.count : null,
        ratingCount: profile.count,
      }))
      .sort(
        (left, right) =>
          (right.ratingAverage ?? -1) - (left.ratingAverage ?? -1),
      );
  }

  private series(
    appointments: MetricAppointment[],
    start: string,
    end: string,
  ) {
    const counts = new Map<string, number>();
    for (const appointment of appointments) {
      if (appointment.status !== AppointmentStatus.CANCELLED) {
        const date = this.lisbonDate(appointment.startsAt);
        counts.set(date, (counts.get(date) ?? 0) + 1);
      }
    }
    const result: Array<{ date: string; appointments: number }> = [];
    for (let date = start; date < end; date = this.addDays(date, 1)) {
      result.push({ date, appointments: counts.get(date) ?? 0 });
    }
    return result;
  }

  private dailyBreakdown(appointments: MetricAppointment[], month: string) {
    const dates = this.monthDates(month);
    return this.series(appointments, dates.start, dates.end);
  }

  private monthDates(month: string) {
    const [year, monthNumber] = month.split('-').map(Number);
    const end =
      monthNumber === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
    return { start: `${month}-01`, end };
  }

  private nextMonth(month: string) {
    return this.monthDates(month).end.slice(0, 7);
  }

  private previousMonth(month: string) {
    const [year, monthNumber] = month.split('-').map(Number);
    return monthNumber === 1
      ? `${year - 1}-12`
      : `${year}-${String(monthNumber - 1).padStart(2, '0')}`;
  }

  private range(start: string, end: string) {
    return {
      gte: lisbonDateMinuteToUtc(start, 0),
      lt: lisbonDateMinuteToUtc(end, 0),
    };
  }

  private lisbonDate(value: Date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Lisbon',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value);
  }

  private dayOfWeek(date: string) {
    return [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ][new Date(`${date}T12:00:00Z`).getUTCDay()];
  }

  private weekStart(date: string) {
    const probe = new Date(`${date}T12:00:00Z`);
    probe.setUTCDate(probe.getUTCDate() - ((probe.getUTCDay() + 6) % 7));
    return probe.toISOString().slice(0, 10);
  }

  private addDays(date: string, amount: number) {
    const probe = new Date(`${date}T12:00:00Z`);
    probe.setUTCDate(probe.getUTCDate() + amount);
    return probe.toISOString().slice(0, 10);
  }
}
