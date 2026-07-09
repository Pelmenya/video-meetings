import { Query } from '@nestjs/cqrs';
import { MeetingFileResponseDto } from '../../dto/meeting-file-response.dto';

export class GetMeetingFilesQuery extends Query<MeetingFileResponseDto[]> {
    constructor(
        public readonly meetingId: string,
        public readonly requesterId: string,
    ) {
        super();
    }
}
