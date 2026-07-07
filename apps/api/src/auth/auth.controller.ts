import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LoginCommand, RegisterCommand } from './commands/impl';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post('register')
    @ApiCreatedResponse({ type: AuthResponseDto })
    register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
        return this.commandBus.execute(
            new RegisterCommand(dto.email, dto.password),
        );
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOkResponse({ type: AuthResponseDto })
    login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
        return this.commandBus.execute(
            new LoginCommand(dto.email, dto.password),
        );
    }
}
