import { ApiProperty } from '@nestjs/swagger';
import { MeetingFileKind, MeetingFileStatus } from '@prisma/client';

export class MeetingFileResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    meetingId: string;

    @ApiProperty()
    uploaderId: string;

    @ApiProperty({ enum: MeetingFileKind })
    kind: MeetingFileKind;

    @ApiProperty()
    originalName: string;

    @ApiProperty()
    mimeType: string;

    @ApiProperty()
    sizeBytes: number;

    @ApiProperty({ enum: MeetingFileStatus })
    status: MeetingFileStatus;

    @ApiProperty({ nullable: true })
    errorMessage: string | null;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}
