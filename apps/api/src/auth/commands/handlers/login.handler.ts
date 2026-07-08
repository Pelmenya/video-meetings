import { UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { VerifyUserCredentialsQuery } from '../../../users/queries/impl';
import { AuthResponseDto } from '../../dto/auth-response.dto';
import { TokenService } from '../../token.service';
import { LoginCommand } from '../impl';

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly tokenService: TokenService,
    ) {}

    async execute(command: LoginCommand): Promise<AuthResponseDto> {
        const { email, password } = command;

        const user = await this.queryBus.execute(
            new VerifyUserCredentialsQuery(email, password),
        );
        if (!user) {
            throw new UnauthorizedException('Неверный email или пароль');
        }

        return this.tokenService.buildToken(user.id, user.email);
    }
}
