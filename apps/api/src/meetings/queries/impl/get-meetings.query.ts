import { Query } from '@nestjs/cqrs';
import { MeetingResponseDto } from '../../dto/meeting-response.dto';

export class GetMeetingsQuery extends Query<MeetingResponseDto[]> {
    constructor(public readonly userId: string) {
        super();
    }
}
