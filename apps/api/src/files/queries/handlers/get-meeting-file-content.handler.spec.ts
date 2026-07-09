import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryBus } from '@nestjs/cqrs';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetMeetingFileContentQuery } from '../impl';
import { GetMeetingFileContentHandler } from './get-meeting-file-content.handler';

describe('GetMeetingFileContentHandler', () => {
    const prisma = { meetingFile: { findFirst: jest.fn() } };
    const queryBus = { execute: jest.fn() };
    const config = { get: jest.fn() };
    let handler: GetMeetingFileContentHandler;

    beforeEach(() => {
        jest.clearAllMocks();
        queryBus.execute.mockResolvedValue({ id: 'meeting-1' });
        config.get.mockImplementation(
            (_key: string, defaultValue?: string) => defaultValue,
        );
        handler = new GetMeetingFileContentHandler(
            prisma as unknown as PrismaService,
            queryBus as unknown as QueryBus,
            config as unknown as ConfigService,
        );
    });

    it('resolves the absolute path for an authorized, existing file', async () => {
        prisma.meetingFile.findFirst.mockResolvedValue({
            id: 'file-1',
            meetingId: 'meeting-1',
            storagePath: 'meeting-1/uuid-note.txt',
            mimeType: 'text/plain',
            sizeBytes: 100,
            originalName: 'note.txt',
        });

        const result = await handler.execute(
            new GetMeetingFileContentQuery('meeting-1', 'file-1', 'user-1'),
        );

        expect(prisma.meetingFile.findFirst).toHaveBeenCalledWith({
            where: { id: 'file-1', meetingId: 'meeting-1' },
        });
        expect(result.mimeType).toBe('text/plain');
        expect(result.sizeBytes).toBe(100);
        expect(result.originalName).toBe('note.txt');
        expect(result.absolutePath).toContain('note.txt');
    });

    it('throws NotFoundException when the file does not belong to the meeting', async () => {
        prisma.meetingFile.findFirst.mockResolvedValue(null);

        await expect(
            handler.execute(
                new GetMeetingFileContentQuery(
                    'meeting-1',
                    'missing',
                    'user-1',
                ),
            ),
        ).rejects.toThrow(NotFoundException);
    });

    it('propagates NotFoundException for a non-participant', async () => {
        queryBus.execute.mockRejectedValue(
            new NotFoundException('Meeting not found'),
        );

        await expect(
            handler.execute(
                new GetMeetingFileContentQuery(
                    'meeting-1',
                    'file-1',
                    'outsider',
                ),
            ),
        ).rejects.toThrow(NotFoundException);
        expect(prisma.meetingFile.findFirst).not.toHaveBeenCalled();
    });
});
