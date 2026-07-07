import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface AuthenticatedUser {
    userId: string;
    email: string;
}

function extractBearerToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const token = extractBearerToken(request);
        if (!token) {
            throw new UnauthorizedException('Missing bearer token');
        }

        try {
            const payload = await this.jwtService.verifyAsync<{
                sub: string;
                email: string;
            }>(token);
            const user: AuthenticatedUser = {
                userId: payload.sub,
                email: payload.email,
            };
            (request as Request & { user: AuthenticatedUser }).user = user;
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }

        return true;
    }
}
