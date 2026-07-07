import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiNoContentResponse,
    ApiOkResponse,
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import {
    CreateMeetingCommand,
    DeleteMeetingCommand,
    UpdateMeetingCommand,
} from './commands/impl';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { MeetingResponseDto } from './dto/meeting-response.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { GetMeetingByIdQuery, GetMeetingsQuery } from './queries/impl';

@ApiTags('meetings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meetings')
export class MeetingsController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
    ) {}

    @Post()
    @ApiCreatedResponse({ type: MeetingResponseDto })
    create(
        @CurrentUser() user: AuthenticatedUser,
        @Body() dto: CreateMeetingDto,
    ): Promise<MeetingResponseDto> {
        return this.commandBus.execute(
            new CreateMeetingCommand(
                user.userId,
                dto.title,
                dto.date,
                dto.participants ?? [],
            ),
        );
    }

    @Get()
    @ApiOkResponse({ type: [MeetingResponseDto] })
    findAll(
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<MeetingResponseDto[]> {
        return this.queryBus.execute(new GetMeetingsQuery(user.userId));
    }

    @Get(':id')
    @ApiOkResponse({ type: MeetingResponseDto })
    findOne(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<MeetingResponseDto> {
        return this.queryBus.execute(new GetMeetingByIdQuery(id, user.userId));
    }

    @Patch(':id')
    @ApiOkResponse({ type: MeetingResponseDto })
    update(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateMeetingDto,
    ): Promise<MeetingResponseDto> {
        return this.commandBus.execute(
            new UpdateMeetingCommand(id, user.userId, {
                title: dto.title,
                date: dto.date,
                participantIds: dto.participants,
                status: dto.status,
            }),
        );
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiNoContentResponse()
    remove(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<void> {
        return this.commandBus.execute(
            new DeleteMeetingCommand(id, user.userId),
        );
    }
}
