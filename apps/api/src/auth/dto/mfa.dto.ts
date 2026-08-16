import { IsString, Length, Matches, MinLength } from 'class-validator';

export class SetupMfaDto {
  @IsString()
  @MinLength(8)
  currentPassword!: string;
}

export class ConfirmMfaDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class DisableMfaDto extends SetupMfaDto {
  @IsString()
  @Length(6, 20)
  code!: string;
}
