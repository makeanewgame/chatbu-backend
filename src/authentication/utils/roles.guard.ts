import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Observable } from "rxjs";

@Injectable()
export class RolesGuard implements CanActivate {

    constructor(private reflector: Reflector, private jwtService: JwtService) { }
    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const permission = this.reflector.getAllAndOverride<string[]>('permission', [
            context.getHandler(),
            context.getClass()
        ]);
        if (!permission) {
            return true;
        }

        // const token = ExtractJwt.fromAuthHeaderAsBearerToken()(context.switchToHttp().getRequest());
        // const decodedToken: JwtPayload = this.jwtService.decode(token, { complete: true } as any);
        // const roles = decodedToken.payload.role;

        const checkRole = true;

        if (checkRole) {
            return true;
        }
        return false;
    }

}