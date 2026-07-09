import { GetMeetingFilesHandler } from './get-meeting-files.handler';
import { GetMeetingFileContentHandler } from './get-meeting-file-content.handler';

export const FileQueryHandlers = [
    GetMeetingFilesHandler,
    GetMeetingFileContentHandler,
];
