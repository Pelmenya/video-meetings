import * as fs from 'node:fs';
import {
    Body,
    Controller,
    Get,
    Headers,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Post,
    Res,
    StreamableFile,
    UploadedFile,
    UseFilters,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiCreatedResponse,
    ApiOkResponse,
    ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { UploadMeetingFileCommand } from './commands/impl';
import { MeetingFileResponseDto } from './dto/meeting-file-response.dto';
import { UploadMeetingFileDto } from './dto/upload-meeting-file.dto';
import { MulterExceptionFilter } from './multer-exception.filter';
import {
    GetMeetingFileContentQuery,
    GetMeetingFilesQuery,
} from './queries/impl';
import { getMaxUploadSizeBytes } from './upload.constants';

@ApiTags('meeting-files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meetings/:id/files')
export class FilesController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
    ) {}

    @Post()
    @UseFilters(MulterExceptionFilter)
    @UseInterceptors(
        FileInterceptor('file', {
            limits: { fileSize: getMaxUploadSizeBytes() },
        }),
    )
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                kind: { type: 'string', enum: ['RECORDING', 'ATTACHMENT'] },
                file: { type: 'string', format: 'binary' },
            },
        },
    })
    @ApiCreatedResponse({ type: MeetingFileResponseDto })
    create(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id', ParseUUIDPipe) meetingId: string,
        @Body() dto: UploadMeetingFileDto,
        @UploadedFile() file: Express.Multer.File,
    ): Promise<MeetingFileResponseDto> {
        return this.commandBus.execute(
            new UploadMeetingFileCommand(
                meetingId,
                user.userId,
                dto.kind,
                file,
            ),
        );
    }

    @Get()
    @ApiOkResponse({ type: [MeetingFileResponseDto] })
    findAll(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id', ParseUUIDPipe) meetingId: string,
    ): Promise<MeetingFileResponseDto[]> {
        return this.queryBus.execute(
            new GetMeetingFilesQuery(meetingId, user.userId),
        );
    }

    @Get(':fileId/content')
    @ApiOkResponse({
        description: 'Содержимое файла (поддерживает заголовок Range)',
    })
    async content(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id', ParseUUIDPipe) meetingId: string,
        @Param('fileId', ParseUUIDPipe) fileId: string,
        @Headers('range') range: string | undefined,
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        const target = await this.queryBus.execute(
            new GetMeetingFileContentQuery(meetingId, fileId, user.userId),
        );
        const total = target.sizeBytes;

        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', target.mimeType);
        res.setHeader(
            'Content-Disposition',
            `inline; filename="${encodeURIComponent(target.originalName)}"`,
        );

        if (!range) {
            res.setHeader('Content-Length', total);
            return new StreamableFile(fs.createReadStream(target.absolutePath));
        }

        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2])) {
            res.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
            res.setHeader('Content-Range', `bytes */${total}`);
            return new StreamableFile(Buffer.alloc(0));
        }

        const start = match[1]
            ? parseInt(match[1], 10)
            : total - parseInt(match[2], 10);
        const end = match[2] && match[1] ? parseInt(match[2], 10) : total - 1;

        if (start > end || end >= total || start < 0) {
            res.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
            res.setHeader('Content-Range', `bytes */${total}`);
            return new StreamableFile(Buffer.alloc(0));
        }

        res.status(HttpStatus.PARTIAL_CONTENT);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', end - start + 1);
        return new StreamableFile(
            fs.createReadStream(target.absolutePath, { start, end }),
        );
    }
}
