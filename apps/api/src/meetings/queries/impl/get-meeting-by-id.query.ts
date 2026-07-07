import { Query } from '@nestjs/cqrs';
import { MeetingResponseDto } from '../../dto/meeting-response.dto';

export class GetMeetingByIdQuery extends Query<MeetingResponseDto> {
    constructor(
        public readonly meetingId: string,
        public readonly userId: string,
    ) {
        super();
    }
}
