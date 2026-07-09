import { NotFoundException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { MeetingFileKind } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetMeetingFilesQuery } from '../impl';
import { GetMeetingFilesHandler } from './get-meeting-files.handler';

describe('GetMeetingFilesHandler', () => {
    const prisma = { meetingFile: { findMany: jest.fn() } };
    const queryBus = { execute: jest.fn() };
    let handler: GetMeetingFilesHandler;

    beforeEach(() => {
        jest.clearAllMocks();
        handler = new GetMeetingFilesHandler(
            prisma as unknown as PrismaService,
            queryBus as unknown as QueryBus,
        );
    });

    it('returns the mapped list of files for an authorized meeting', async () => {
        queryBus.execute.mockResolvedValue({ id: 'meeting-1' });
        const createdAt = new Date('2026-01-01');
        prisma.meetingFile.findMany.mockResolvedValue([
            {
                id: 'file-1',
                meetingId: 'meeting-1',
                uploaderId: 'user-1',
                kind: MeetingFileKind.ATTACHMENT,
                originalName: 'note.txt',
                mimeType: 'text/plain',
                sizeBytes: 100,
                storagePath: 'meeting-1/uuid-note.txt',
                status: 'READY',
                errorMessage: null,
                createdAt,
                updatedAt: createdAt,
            },
        ]);

        const result = await handler.execute(
            new GetMeetingFilesQuery('meeting-1', 'user-1'),
        );

        expect(prisma.meetingFile.findMany).toHaveBeenCalledWith({
            where: { meetingId: 'meeting-1' },
            orderBy: { createdAt: 'asc' },
        });
        expect(result).toHaveLength(1);
        expect(result[0]).not.toHaveProperty('storagePath');
    });

    it('propagates NotFoundException for a non-participant', async () => {
        queryBus.execute.mockRejectedValue(
            new NotFoundException('Meeting not found'),
        );

        await expect(
            handler.execute(new GetMeetingFilesQuery('meeting-1', 'outsider')),
        ).rejects.toThrow(NotFoundException);
        expect(prisma.meetingFile.findMany).not.toHaveBeenCalled();
    });
});
