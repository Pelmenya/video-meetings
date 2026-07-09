import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { FileCommandHandlers } from './commands/handlers';
import { FilesController } from './files.controller';
import { FileQueryHandlers } from './queries/handlers';

@Module({
    imports: [CqrsModule, AuthModule, MeetingsModule],
    controllers: [FilesController],
    providers: [...FileCommandHandlers, ...FileQueryHandlers],
})
export class FilesModule {}
