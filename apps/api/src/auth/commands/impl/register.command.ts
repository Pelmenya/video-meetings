import { Command } from '@nestjs/cqrs';
import { AuthResponseDto } from '../../dto/auth-response.dto';

export class RegisterCommand extends Command<AuthResponseDto> {
    constructor(
        public readonly email: string,
        public readonly password: string,
    ) {
        super();
    }
}
