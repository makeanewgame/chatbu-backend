import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: process.env.JWT_SECRET
        });
    }

    validate(payload: any) {
        // Only session ("auth") tokens may authenticate protected routes.
        // Embed/refresh tokens are signed with the same JWT_SECRET but must not
        // be accepted here, otherwise a widget embed token could reach
        // dashboard endpoints.
        if (payload?.type !== 'auth') {
            throw new UnauthorizedException('Invalid token type');
        }
        return payload;
    }
}