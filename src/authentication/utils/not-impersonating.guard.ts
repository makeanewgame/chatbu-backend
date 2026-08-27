import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Blocks a route when the current session is an admin impersonation session
 * (the JWT carries an `act` actor claim, set by AdminService.impersonateUser).
 *
 * Must run AFTER AccessTokenGuard so `req.user` is populated with the decoded
 * payload: `@UseGuards(AccessTokenGuard, NotImpersonatingGuard)`.
 *
 * Used to fence off destructive self-service actions (account deletion,
 * password change) that an admin should never perform while "logged in as"
 * a customer.
 */
@Injectable()
export class NotImpersonatingGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    if (req.user?.act) {
      throw new ForbiddenException(
        'Bu işlem kullanıcı olarak görüntüleme (impersonation) oturumunda yapılamaz.',
      );
    }

    return true;
  }
}
