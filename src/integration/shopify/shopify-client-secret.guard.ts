import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';

/**
 * Guard for the server-to-server code->token exchange, called only by the
 * Chatbu Shopify app backend (never a browser). Same shape as
 * InternalApiKeyGuard, its own header/secret so rotating one never affects
 * the other caller.
 */
@Injectable()
export class ShopifyClientSecretGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const secret = request.headers['x-shopify-client-secret'];
        const expected = process.env.SHOPIFY_APP_CLIENT_SECRET;

        if (!expected || secret !== expected) {
            throw new UnauthorizedException({ error: 'unauthorized' });
        }

        return true;
    }
}
