import { ApiProperty } from '@nestjs/swagger';
import { MeetingStatus } from '@prisma/client';

export class MeetingResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    date: Date;

    @ApiProperty({ enum: MeetingStatus })
    status: MeetingStatus;

    @ApiProperty()
    hostId: string;

    @ApiProperty({ type: [String] })
    participants: string[];

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}
