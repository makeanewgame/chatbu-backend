import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private jwtService: JwtService) { }

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest();
        const authHeader = req.headers['authorization'];

        if (!authHeader?.startsWith('Bearer ')) {
            throw new ForbiddenException('No token provided');
        }

        try {
            const token = authHeader.split(' ')[1];
            const decoded = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });

            if (decoded.type !== 'auth') {
                throw new ForbiddenException('Invalid token type');
            }

            if (decoded.role !== 'ADMIN') {
                throw new ForbiddenException('Admin access required');
            }

            req.user = decoded;
            return true;
        } catch (e) {
            if (e instanceof ForbiddenException) {
                throw e;
            }
            throw new ForbiddenException('Invalid token');
        }
    }
}
