import { IsString, MaxLength } from 'class-validator';

export class ProfileImageDto {
  @IsString()
  @MaxLength(1_500_000)
  dataUrl!: string;
}
