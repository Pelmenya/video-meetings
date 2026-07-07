import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../prisma/prisma.service';
import { MeetingResponseDto } from '../../dto/meeting-response.dto';
import {
    MEETING_WITH_PARTICIPANTS,
    toMeetingResponse,
} from '../../meeting.mapper';
import { CreateMeetingCommand } from '../impl';

@CommandHandler(CreateMeetingCommand)
export class CreateMeetingHandler implements ICommandHandler<CreateMeetingCommand> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(command: CreateMeetingCommand): Promise<MeetingResponseDto> {
        const { hostId, title, date, participantIds } = command;

        if (participantIds.length > 0) {
            const existing = await this.prisma.user.findMany({
                where: { id: { in: participantIds } },
                select: { id: true },
            });
            if (existing.length !== new Set(participantIds).size) {
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
