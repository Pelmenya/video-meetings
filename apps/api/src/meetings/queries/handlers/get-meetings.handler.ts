import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../prisma/prisma.service';
import { MeetingResponseDto } from '../../dto/meeting-response.dto';
import {
    MEETING_WITH_PARTICIPANTS,
    toMeetingResponse,
} from '../../meeting.mapper';
import { GetMeetingsQuery } from '../impl';

@QueryHandler(GetMeetingsQuery)
export class GetMeetingsHandler implements IQueryHandler<GetMeetingsQuery> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(query: GetMeetingsQuery): Promise<MeetingResponseDto[]> {
        const meetings = await this.prisma.meeting.findMany({
            where: {
                OR: [
                    { hostId: query.userId },
                    { participants: { some: { id: query.userId } } },
                ],
            },
            ...MEETING_WITH_PARTICIPANTS,
        });

        return meetings.map(toMeetingResponse);
    }
}
