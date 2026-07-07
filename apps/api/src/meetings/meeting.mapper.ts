import { Prisma } from '@prisma/client';
import { MeetingResponseDto } from './dto/meeting-response.dto';

export const MEETING_WITH_PARTICIPANTS =
    Prisma.validator<Prisma.MeetingDefaultArgs>()({
        include: { participants: { select: { id: true } } },
    });

export type MeetingWithParticipants = Prisma.MeetingGetPayload<
    typeof MEETING_WITH_PARTICIPANTS
>;

export function toMeetingResponse(
    meeting: MeetingWithParticipants,
): MeetingResponseDto {
    return {
        id: meeting.id,
        title: meeting.title,
        date: meeting.date,
        status: meeting.status,
        hostId: meeting.hostId,
        participants: meeting.participants.map((p) => p.id),
        createdAt: meeting.createdAt,
        updatedAt: meeting.updatedAt,
    };
}
