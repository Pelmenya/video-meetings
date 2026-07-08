import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateUserCommand } from '../../../users/commands/impl';
import { AuthResponseDto } from '../../dto/auth-response.dto';
import { TokenService } from '../../token.service';
import { RegisterCommand } from '../impl';

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly tokenService: TokenService,
    ) {}

    async execute(command: RegisterCommand): Promise<AuthResponseDto> {
        const { email, password } = command;

        const user = await this.commandBus.execute(
            new CreateUserCommand(email, password),
        );

        return this.tokenService.buildToken(user.id, user.email);
    }
}
