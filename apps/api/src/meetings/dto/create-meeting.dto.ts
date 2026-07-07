import { ApiProperty } from '@nestjs/swagger';
import {
    IsArray,
    IsISO8601,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

export class CreateMeetingDto {
    @ApiProperty({ example: 'Sprint planning' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ example: '2026-07-10T10:00:00.000Z' })
    @IsISO8601()
    date: string;

    @ApiProperty({
        description: 'Existing user ids to invite',
        type: [String],
        required: false,
    })
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    participants?: string[];
}
