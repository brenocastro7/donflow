import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';

@Injectable()
export class AppointmentsLifecycleService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AppointmentsLifecycleService.name);
  private interval?: NodeJS.Timeout;
  private processing = false;

  constructor(private readonly appointments: AppointmentsService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.interval = setInterval(() => void this.process(), 60_000);
    this.interval.unref();
    setTimeout(() => void this.process(), 2_000).unref();
  }

  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
  }

  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      const completed = await this.appointments.completeDueAppointments();
      if (completed) {
        this.logger.log(`${completed} appointment(s) completed automatically.`);
      }
    } catch (error) {
      this.logger.error('Automatic appointment completion failed.', error);
    } finally {
      this.processing = false;
    }
  }
}
