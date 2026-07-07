import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { CommandHandlers } from './commands/handlers';
import { EventHandlers } from './events/handlers';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TokenService } from './token.service';

@Module({
    imports: [
        CqrsModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
                signOptions: {
                    expiresIn: parseInt(
                        config.get<string>('JWT_EXPIRES_IN', '3600'),
                        10,
                    ),
                },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [
        TokenService,
        JwtAuthGuard,
        ...CommandHandlers,
        ...EventHandlers,
    ],
    exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
