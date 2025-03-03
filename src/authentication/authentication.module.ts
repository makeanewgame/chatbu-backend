import { Module } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { AuthenticationController } from './authentication.controller';
import { DrizzleModule } from 'src/drizzle/drizzle.module';
import { JwtModule } from '@nestjs/jwt';
import { LocalStrategy } from './utils/local.strategy';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './utils/roles.guard';
import { JwtStrategy } from './utils/jwt.strategy';
import { RefJwtStrategy } from './utils/refjwt.strategy';
import { GoogleStrategy } from './utils/google.strategy';

@Module({
  imports: [
    DrizzleModule,
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
    {
      provide: 'AUTH_SERVICE',
      useClass: AuthenticationService,
    },
    AuthenticationService,],
  controllers: [AuthenticationController],

})
export class AuthenticationModule { }
