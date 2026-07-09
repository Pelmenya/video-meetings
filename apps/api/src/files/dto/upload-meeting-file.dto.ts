import { ApiProperty } from '@nestjs/swagger';
import { MeetingFileKind } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UploadMeetingFileDto {
    @ApiProperty({ enum: MeetingFileKind, example: MeetingFileKind.ATTACHMENT })
    @IsEnum(MeetingFileKind, {
        message: 'Тип файла должен быть RECORDING или ATTACHMENT',
    })
    kind: MeetingFileKind;
}
