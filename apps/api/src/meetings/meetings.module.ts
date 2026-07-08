import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { MeetingCommandHandlers } from './commands/handlers';
import { MeetingsController } from './meetings.controller';
import { MeetingQueryHandlers } from './queries/handlers';

@Module({
    imports: [CqrsModule, AuthModule, UsersModule],
    controllers: [MeetingsController],
    providers: [...MeetingCommandHandlers, ...MeetingQueryHandlers],
})
export class MeetingsModule {}
