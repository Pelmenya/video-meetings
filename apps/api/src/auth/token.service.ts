import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class TokenService {
    constructor(private readonly jwtService: JwtService) {}

    buildToken(userId: string, email: string): AuthResponseDto {
        return {
            accessToken: this.jwtService.sign({ sub: userId, email }),
        };
    }
}
