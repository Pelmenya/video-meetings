import { Command } from '@nestjs/cqrs';
import { MeetingStatus } from '@prisma/client';
import { MeetingResponseDto } from '../../dto/meeting-response.dto';

export class UpdateMeetingCommand extends Command<MeetingResponseDto> {
    constructor(
        public readonly meetingId: string,
        public readonly requesterId: string,
        public readonly changes: {
            title?: string;
            date?: string;
            participantIds?: string[];
            status?: MeetingStatus;
        },
    ) {
        super();
    }
}
