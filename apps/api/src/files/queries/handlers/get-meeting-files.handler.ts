import { IQueryHandler, QueryHandler, QueryBus } from '@nestjs/cqrs';
import { GetMeetingByIdQuery } from '../../../meetings/queries/impl';
import { PrismaService } from '../../../prisma/prisma.service';
import { MeetingFileResponseDto } from '../../dto/meeting-file-response.dto';
import { toMeetingFileResponse } from '../../file.mapper';
import { GetMeetingFilesQuery } from '../impl';

@QueryHandler(GetMeetingFilesQuery)
export class GetMeetingFilesHandler implements IQueryHandler<GetMeetingFilesQuery> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly queryBus: QueryBus,
    ) {}

    async execute(
        query: GetMeetingFilesQuery,
    ): Promise<MeetingFileResponseDto[]> {
        await this.queryBus.execute(
            new GetMeetingByIdQuery(query.meetingId, query.requesterId),
        );

        const files = await this.prisma.meetingFile.findMany({
            where: { meetingId: query.meetingId },
            orderBy: { createdAt: 'asc' },
        });

        return files.map(toMeetingFileResponse);
    }
}
