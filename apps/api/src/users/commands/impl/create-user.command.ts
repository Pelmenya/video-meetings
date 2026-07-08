import { Command } from '@nestjs/cqrs';
import { UserDto } from '../../dto/user.dto';

export class CreateUserCommand extends Command<UserDto> {
    constructor(
        public readonly email: string,
        public readonly password: string,
    ) {
        super();
    }
}
