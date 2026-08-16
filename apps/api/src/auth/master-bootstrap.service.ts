import { ConflictException, Injectable } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { argon2id, hash } from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { assertStrongPassword } from './password-policy';

export interface BootstrapMasterInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

@Injectable()
export class MasterBootstrapService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrap(input: BootstrapMasterInput) {
    assertStrongPassword(input.password);
    const existingMaster = await this.prisma.user.findFirst({
      where: { role: UserRole.MASTER },
      select: { id: true, email: true },
    });

    if (existingMaster) {
      return { created: false, user: existingMaster };
    }

    const email = input.email.trim().toLowerCase();
    const phone = input.phone?.trim() || undefined;
    const passwordHash = await hash(input.password, { type: argon2id });

    try {
      const user = await this.prisma.user.create({
        data: {
          name: input.name.trim(),
          email,
          phone,
          passwordHash,
          emailVerifiedAt: new Date(),
          role: UserRole.MASTER,
          status: UserStatus.ACTIVE,
          barberProfile: {
            create: { displayName: input.name.trim() },
          },
        },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          barberProfile: { select: { id: true } },
        },
      });

      return { created: true, user };
    } catch {
      throw new ConflictException(
        'A identidade administrativa entra em conflito com uma conta existente.',
      );
    }
  }
}
