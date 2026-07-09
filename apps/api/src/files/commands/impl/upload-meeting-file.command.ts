import { Command } from '@nestjs/cqrs';
import { MeetingFileKind } from '@prisma/client';
import { MeetingFileResponseDto } from '../../dto/meeting-file-response.dto';

export class UploadMeetingFileCommand extends Command<MeetingFileResponseDto> {
    constructor(
        public readonly meetingId: string,
        public readonly uploaderId: string,
        public readonly kind: MeetingFileKind,
        public readonly file: Express.Multer.File,
    ) {
        super();
    }
}
