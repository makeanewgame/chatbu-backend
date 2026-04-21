import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';

/**
 * Guard for internal service-to-service calls.
 * Validates the X-Internal-Key header against MCP_INTERNAL_API_KEY env var.
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const apiKey = request.headers['x-internal-key'];
        const expectedKey = process.env.MCP_INTERNAL_API_KEY;

        if (!expectedKey || apiKey !== expectedKey) {
            throw new UnauthorizedException({ error: 'unauthorized' });
        }

        return true;
    }
}
