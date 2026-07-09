import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/auth.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { FileCommandHandlers } from './commands/handlers';
import { FilesController } from './files.controller';
import { FileQueryHandlers } from './queries/handlers';
import { getMaxUploadSizeBytes } from './upload.constants';

@Module({
    imports: [
        CqrsModule,
        AuthModule,
        MeetingsModule,
        MulterModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                limits: { fileSize: getMaxUploadSizeBytes(config) },
            }),
        }),
    ],
    controllers: [FilesController],
    providers: [...FileCommandHandlers, ...FileQueryHandlers],
})
export class FilesModule {}
