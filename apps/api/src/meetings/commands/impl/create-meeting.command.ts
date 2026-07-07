import { Command } from '@nestjs/cqrs';
import { MeetingResponseDto } from '../../dto/meeting-response.dto';

export class CreateMeetingCommand extends Command<MeetingResponseDto> {
    constructor(
        public readonly hostId: string,
        public readonly title: string,
        public readonly date: string,
        public readonly participantIds: string[],
    ) {
        super();
    }
}
