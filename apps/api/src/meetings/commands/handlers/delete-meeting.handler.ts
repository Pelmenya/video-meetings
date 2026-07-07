import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../prisma/prisma.service';
import { assertHost, assertHostOrParticipant } from '../../meeting-access';
import { MEETING_WITH_PARTICIPANTS } from '../../meeting.mapper';
import { DeleteMeetingCommand } from '../impl';

@CommandHandler(DeleteMeetingCommand)
export class DeleteMeetingHandler implements ICommandHandler<DeleteMeetingCommand> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(command: DeleteMeetingCommand): Promise<void> {
        const { meetingId, requesterId } = command;

        const existing = await this.prisma.meeting.findUnique({
            where: { id: meetingId },
            ...MEETING_WITH_PARTICIPANTS,
        });
        if (!existing) {
            throw new NotFoundException('Meeting not found');
        }
        assertHostOrParticipant(existing, requesterId);
        assertHost(existing, requesterId);

        await this.prisma.meeting.delete({ where: { id: meetingId } });
    }
}
