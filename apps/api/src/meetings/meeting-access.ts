import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MeetingWithParticipants } from './meeting.mapper';

export function assertHostOrParticipant(
    meeting: MeetingWithParticipants,
    userId: string,
): void {
    const isHost = meeting.hostId === userId;
    const isParticipant = meeting.participants.some((p) => p.id === userId);
    if (!isHost && !isParticipant) {
        throw new NotFoundException('Meeting not found');
    }
}

export function assertHost(
    meeting: MeetingWithParticipants,
    userId: string,
): void {
    if (meeting.hostId !== userId) {
        throw new ForbiddenException('Only the host can perform this action');
    }
}
