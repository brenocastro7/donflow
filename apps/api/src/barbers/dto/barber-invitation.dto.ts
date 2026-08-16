import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  STRONG_PASSWORD_MESSAGE,
  STRONG_PASSWORD_PATTERN,
} from '../../auth/password-policy';

export class InviteBarberDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class CompleteBarberInvitationDto {
  @IsString()
  @MinLength(64)
  @MaxLength(64)
  token!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Matches(/^\+[1-9]\d{7,14}$/)
  phone!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(72)
  @Matches(STRONG_PASSWORD_PATTERN, { message: STRONG_PASSWORD_MESSAGE })
  password!: string;
}
