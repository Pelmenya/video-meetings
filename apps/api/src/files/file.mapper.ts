import { MeetingFile } from '@prisma/client';
import { MeetingFileResponseDto } from './dto/meeting-file-response.dto';

export function toMeetingFileResponse(
    file: MeetingFile,
): MeetingFileResponseDto {
    return {
        id: file.id,
        meetingId: file.meetingId,
        uploaderId: file.uploaderId,
        kind: file.kind,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        status: file.status,
        errorMessage: file.errorMessage,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
    };
}
