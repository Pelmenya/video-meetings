import { Query } from '@nestjs/cqrs';

export interface MeetingFileContent {
    absolutePath: string;
    mimeType: string;
    sizeBytes: number;
    originalName: string;
}

export class GetMeetingFileContentQuery extends Query<MeetingFileContent> {
    constructor(
        public readonly meetingId: string,
        public readonly fileId: string,
        public readonly requesterId: string,
    ) {
        super();
    }
}
