import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../prisma/prisma.service';
import { MeetingResponseDto } from '../../dto/meeting-response.dto';
import { assertHostOrParticipant } from '../../meeting-access';
import {
    MEETING_WITH_PARTICIPANTS,
    toMeetingResponse,
} from '../../meeting.mapper';
import { GetMeetingByIdQuery } from '../impl';

@QueryHandler(GetMeetingByIdQuery)
export class GetMeetingByIdHandler implements IQueryHandler<GetMeetingByIdQuery> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(query: GetMeetingByIdQuery): Promise<MeetingResponseDto> {
        const meeting = await this.prisma.meeting.findUnique({
            where: { id: query.meetingId },
            ...MEETING_WITH_PARTICIPANTS,
        });
        if (!meeting) {
            throw new NotFoundException('Meeting not found');
        }
        assertHostOrParticipant(meeting, query.userId);

        return toMeetingResponse(meeting);
    }
}
