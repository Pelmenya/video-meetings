import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { Prisma } from '@prisma/client';
import { FindUsersByIdsQuery } from '../../../users/queries/impl';
import { PrismaService } from '../../../prisma/prisma.service';
import { MeetingResponseDto } from '../../dto/meeting-response.dto';
import { assertHost, assertHostOrParticipant } from '../../meeting-access';
import {
    MEETING_WITH_PARTICIPANTS,
    toMeetingResponse,
} from '../../meeting.mapper';
import { UpdateMeetingCommand } from '../impl';

@CommandHandler(UpdateMeetingCommand)
export class UpdateMeetingHandler implements ICommandHandler<UpdateMeetingCommand> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly queryBus: QueryBus,
    ) {}

    async execute(command: UpdateMeetingCommand): Promise<MeetingResponseDto> {
        const { meetingId, requesterId, changes } = command;

        const existing = await this.prisma.meeting.findUnique({
            where: { id: meetingId },
            ...MEETING_WITH_PARTICIPANTS,
        });
        if (!existing) {
            throw new NotFoundException('Meeting not found');
        }
        assertHostOrParticipant(existing, requesterId);
        assertHost(existing, requesterId);

        if (changes.participantIds) {
            const foundIds = await this.queryBus.execute(
                new FindUsersByIdsQuery(changes.participantIds),
            );
            if (foundIds.length !== new Set(changes.participantIds).size) {
                throw new BadRequestException(
                    'One or more participants do not exist',
                );
            }
        }

        const data: Prisma.MeetingUpdateInput = {
            ...(changes.title !== undefined && { title: changes.title }),
            ...(changes.date !== undefined && {
                date: new Date(changes.date),
            }),
            ...(changes.status !== undefined && { status: changes.status }),
            ...(changes.participantIds !== undefined && {
                participants: {
                    set: changes.participantIds.map((id) => ({ id })),
                },
            }),
        };

        const meeting = await this.prisma.meeting.update({
            where: { id: meetingId },
            data,
            ...MEETING_WITH_PARTICIPANTS,
        });

        return toMeetingResponse(meeting);
    }
}
