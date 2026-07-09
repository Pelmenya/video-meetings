import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { MeetingFileKind } from '@prisma/client';
import { GetMeetingByIdQuery } from '../../../meetings/queries/impl';
import { PrismaService } from '../../../prisma/prisma.service';
import { MeetingFileResponseDto } from '../../dto/meeting-file-response.dto';
import { toMeetingFileResponse } from '../../file.mapper';
import { resolveStorageRoot, saveFileToDisk } from '../../storage.util';
import {
    ALLOWED_ATTACHMENT_MIME_TYPES,
    ALLOWED_RECORDING_MIME_TYPES,
    getMaxUploadSizeBytes,
} from '../../upload.constants';
import { UploadMeetingFileCommand } from '../impl';

@CommandHandler(UploadMeetingFileCommand)
export class UploadMeetingFileHandler implements ICommandHandler<UploadMeetingFileCommand> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly queryBus: QueryBus,
        private readonly config: ConfigService,
    ) {}

    async execute(
        command: UploadMeetingFileCommand,
    ): Promise<MeetingFileResponseDto> {
        const { meetingId, uploaderId, kind, file } = command;

        await this.queryBus.execute(
            new GetMeetingByIdQuery(meetingId, uploaderId),
        );

        if (!file) {
            throw new BadRequestException('Файл не был передан');
        }

        const allowedMimeTypes =
            kind === MeetingFileKind.RECORDING
                ? ALLOWED_RECORDING_MIME_TYPES
                : ALLOWED_ATTACHMENT_MIME_TYPES;

        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new BadRequestException(
                kind === MeetingFileKind.RECORDING
                    ? 'Недопустимый формат записи: поддерживаются только аудио и видео файлы'
                    : 'Недопустимый формат вложения',
            );
        }

        const maxUploadSizeBytes = getMaxUploadSizeBytes();
        if (file.size > maxUploadSizeBytes) {
            throw new BadRequestException(
                `Размер файла превышает допустимый лимит (${Math.floor(
                    maxUploadSizeBytes / (1024 * 1024),
                )} МБ)`,
            );
        }

        const storageRoot = resolveStorageRoot(this.config);
        const storagePath = await saveFileToDisk(
            storageRoot,
            meetingId,
            file.originalname,
            file.buffer,
        );

        const meetingFile = await this.prisma.meetingFile.create({
            data: {
                kind,
                originalName: file.originalname,
                mimeType: file.mimetype,
                sizeBytes: file.size,
                storagePath,
                status: 'READY',
                meeting: { connect: { id: meetingId } },
                uploader: { connect: { id: uploaderId } },
            },
        });

        return toMeetingFileResponse(meetingFile);
    }
}
