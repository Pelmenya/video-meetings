import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { FindUsersByIdsQuery } from '../../../users/queries/impl';
import { PrismaService } from '../../../prisma/prisma.service';
import { MeetingResponseDto } from '../../dto/meeting-response.dto';
import {
    MEETING_WITH_PARTICIPANTS,
    toMeetingResponse,
} from '../../meeting.mapper';
import { CreateMeetingCommand } from '../impl';

@CommandHandler(CreateMeetingCommand)
export class CreateMeetingHandler implements ICommandHandler<CreateMeetingCommand> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly queryBus: QueryBus,
    ) {}

    async execute(command: CreateMeetingCommand): Promise<MeetingResponseDto> {
        const { hostId, title, date, participantIds } = command;

        if (participantIds.length > 0) {
            const existingIds = await this.queryBus.execute(
                new FindUsersByIdsQuery(participantIds),
            );
            if (existingIds.length !== new Set(participantIds).size) {
                throw new BadRequestException(
                    'One or more participants do not exist',
                );
            }
        }

        const meeting = await this.prisma.meeting.create({
            data: {
                title,
                date: new Date(date),
                host: { connect: { id: hostId } },
                participants: {
                    connect: participantIds.map((id) => ({ id })),
                },
            },
            ...MEETING_WITH_PARTICIPANTS,
        });

        return toMeetingResponse(meeting);
    }
}
