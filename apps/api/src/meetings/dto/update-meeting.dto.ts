import { ApiProperty } from '@nestjs/swagger';
import { MeetingStatus } from '@prisma/client';
import {
    IsArray,
    IsEnum,
    IsISO8601,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

export class UpdateMeetingDto {
    @ApiProperty({ example: 'Sprint planning', required: false })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    title?: string;

    @ApiProperty({ example: '2026-07-10T10:00:00.000Z', required: false })
    @IsOptional()
    @IsISO8601()
    date?: string;

    @ApiProperty({
        description: 'Existing user ids to invite',
        type: [String],
        required: false,
    })
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    participants?: string[];

    @ApiProperty({ enum: MeetingStatus, required: false })
    @IsOptional()
    @IsEnum(MeetingStatus)
    status?: MeetingStatus;
}
