import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IQueryHandler, QueryHandler, QueryBus } from '@nestjs/cqrs';
import { GetMeetingByIdQuery } from '../../../meetings/queries/impl';
import { PrismaService } from '../../../prisma/prisma.service';
import { resolveAbsolutePath, resolveStorageRoot } from '../../storage.util';
import { GetMeetingFileContentQuery, MeetingFileContent } from '../impl';

@QueryHandler(GetMeetingFileContentQuery)
export class GetMeetingFileContentHandler implements IQueryHandler<GetMeetingFileContentQuery> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly queryBus: QueryBus,
        private readonly config: ConfigService,
    ) {}

    async execute(
        query: GetMeetingFileContentQuery,
    ): Promise<MeetingFileContent> {
        await this.queryBus.execute(
            new GetMeetingByIdQuery(query.meetingId, query.requesterId),
        );

        const file = await this.prisma.meetingFile.findFirst({
            where: { id: query.fileId, meetingId: query.meetingId },
        });
        if (!file) {
            throw new NotFoundException('Файл не найден');
        }

        const storageRoot = resolveStorageRoot(this.config);

        return {
            absolutePath: resolveAbsolutePath(storageRoot, file.storagePath),
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            originalName: file.originalName,
        };
    }
}
