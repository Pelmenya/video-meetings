import { ConflictException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthResponseDto } from '../../dto/auth-response.dto';
import { UserRegisteredEvent } from '../../events/impl';
import { TokenService } from '../../token.service';
import { RegisterCommand } from '../impl';

const SALT_ROUNDS = 10;

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly tokenService: TokenService,
        private readonly eventBus: EventBus,
    ) {}

    async execute(command: RegisterCommand): Promise<AuthResponseDto> {
        const { email, password } = command;

        const existing = await this.prisma.user.findUnique({
            where: { email },
        });
        if (existing) {
            throw new ConflictException('Такой email уже зарегистрирован');
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const user = await this.prisma.user.create({
            data: { email, password: hashedPassword },
        });

        this.eventBus.publish(new UserRegisteredEvent(user.id, user.email));

        return this.tokenService.buildToken(user.id, user.email);
    }
}
