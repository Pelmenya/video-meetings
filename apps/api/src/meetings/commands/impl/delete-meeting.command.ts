import { Command } from '@nestjs/cqrs';

export class DeleteMeetingCommand extends Command<void> {
    constructor(
        public readonly meetingId: string,
        public readonly requesterId: string,
    ) {
        super();
    }
}
