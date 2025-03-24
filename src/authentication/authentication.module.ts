import { Module } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { AuthenticationController } from './authentication.controller';
import { JwtModule } from '@nestjs/jwt';
import { LocalStrategy } from './utils/local.strategy';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './utils/roles.guard';
import { JwtStrategy } from './utils/jwt.strategy';
import { RefJwtStrategy } from './utils/refjwt.strategy';
import { GoogleStrategy } from './utils/google.strategy';
import { MailService } from 'src/mail/mail.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { QuotaService } from 'src/quota/quota.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}),
    PassportModule.register({
      defaultStrategy: 'jwt',
      session: false,
    })],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    },
    JwtStrategy,
    RefJwtStrategy,
    LocalStrategy,
    GoogleStrategy,
    QuotaService,
    MailService,
    {
      provide: 'AUTH_SERVICE',
      useClass: AuthenticationService,
    },
    AuthenticationService,],
  controllers: [AuthenticationController],

})
export class AuthenticationModule { }
