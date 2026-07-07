import { CreateMeetingHandler } from './create-meeting.handler';
import { UpdateMeetingHandler } from './update-meeting.handler';
import { DeleteMeetingHandler } from './delete-meeting.handler';

export const MeetingCommandHandlers = [
    CreateMeetingHandler,
    UpdateMeetingHandler,
    DeleteMeetingHandler,
];
