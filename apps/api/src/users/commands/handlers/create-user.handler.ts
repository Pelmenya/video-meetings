import { ConflictException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserDto } from '../../dto/user.dto';
import { UserRegisteredEvent } from '../../events/impl';
import { toUserDto } from '../../user.mapper';
import { CreateUserCommand } from '../impl';

const SALT_ROUNDS = 10;

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventBus: EventBus,
    ) {}

    async execute(command: CreateUserCommand): Promise<UserDto> {
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

        return toUserDto(user);
    }
}
