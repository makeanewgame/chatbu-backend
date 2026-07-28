import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Guard for the Chatbu Shopify app's scoped access token (payload.type === 'shopify').
 * Deliberately separate from AccessTokenGuard/JwtStrategy (dashboard 'auth' tokens) so a
 * 'shopify' token — held by a third-party app, narrowly meant for bot listing/selection —
 * can never authenticate the dozens of routes AccessTokenGuard already protects.
 */
@Injectable()
export class ShopifyTokenGuard implements CanActivate {
    constructor(private readonly jwt: JwtService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader: string | undefined = request.headers['authorization'];
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

        if (!token) {
            throw new UnauthorizedException('Missing bearer token');
        }

        try {
            const payload = await this.jwt.verifyAsync(token, {
                secret: process.env.JWT_SECRET,
            });
            if (payload?.type !== 'shopify' || !payload?.teamId) {
                throw new UnauthorizedException('Invalid token type');
            }
            request.user = { teamId: payload.teamId };
            return true;
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }
    }
}
