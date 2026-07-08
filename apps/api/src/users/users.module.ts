import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UserCommandHandlers } from './commands/handlers';
import { UserEventHandlers } from './events/handlers';
import { UserQueryHandlers } from './queries/handlers';

@Module({
    imports: [CqrsModule],
    providers: [
        ...UserCommandHandlers,
        ...UserQueryHandlers,
        ...UserEventHandlers,
    ],
})
export class UsersModule {}
