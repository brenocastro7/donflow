import { IsIn, IsOptional, Matches } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;

  /**
   * MASTER only: 'own' scopes metrics to the MASTER's own agenda, matching
   * what a BARBER sees. Ignored for BARBER, who is always scoped to their
   * own agenda. Omitted or 'general' keeps the whole-shop view.
   */
  @IsOptional()
  @IsIn(['own', 'general'])
  scope?: 'own' | 'general';
}
