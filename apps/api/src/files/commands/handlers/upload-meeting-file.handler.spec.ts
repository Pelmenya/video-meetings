import * as fs from 'node:fs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryBus } from '@nestjs/cqrs';
import { MeetingFileKind } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import * as storageUtil from '../../storage.util';
import { UploadMeetingFileCommand } from '../impl';
import { UploadMeetingFileHandler } from './upload-meeting-file.handler';

jest.mock('../../storage.util', () => ({
    resolveStorageRoot: jest.fn(() => '/tmp/storage'),
    resolveAbsolutePath: jest.fn(
        (root: string, relativePath: string) => `${root}/${relativePath}`,
    ),
    saveFileToDisk: jest.fn(),
}));

function makeFile(overrides: Partial<Express.Multer.File> = {}) {
    return {
        originalname: 'note.txt',
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from('hello'),
        ...overrides,
    } as Express.Multer.File;
}

describe('UploadMeetingFileHandler', () => {
    const prisma = { meetingFile: { create: jest.fn() } };
    const queryBus = { execute: jest.fn() };
    const config = { get: jest.fn() };
    let handler: UploadMeetingFileHandler;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);
        (storageUtil.saveFileToDisk as jest.Mock).mockResolvedValue(
            'meeting-1/uuid-note.txt',
        );
        queryBus.execute.mockResolvedValue({ id: 'meeting-1' });
        handler = new UploadMeetingFileHandler(
            prisma as unknown as PrismaService,
            queryBus as unknown as QueryBus,
            config as unknown as ConfigService,
        );
    });

    it('saves the file to disk and creates a READY meeting file record', async () => {
        const createdAt = new Date('2026-01-01');
        prisma.meetingFile.create.mockResolvedValue({
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
        });

        const result = await handler.execute(
            new UploadMeetingFileCommand(
                'meeting-1',
                'user-1',
                MeetingFileKind.ATTACHMENT,
                makeFile(),
            ),
        );

        expect(queryBus.execute).toHaveBeenCalledWith(
            expect.objectContaining({
                meetingId: 'meeting-1',
                userId: 'user-1',
            }),
        );
        expect(prisma.meetingFile.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                kind: MeetingFileKind.ATTACHMENT,
                originalName: 'note.txt',
                mimeType: 'text/plain',
                sizeBytes: 100,
                storagePath: 'meeting-1/uuid-note.txt',
                status: 'READY',
            }) as unknown,
        });
        expect(result).toEqual(
            expect.objectContaining({ id: 'file-1', status: 'READY' }),
        );
    });

    it('propagates NotFoundException for a non-participant', async () => {
        queryBus.execute.mockRejectedValue(
            new NotFoundException('Meeting not found'),
        );

        await expect(
            handler.execute(
                new UploadMeetingFileCommand(
                    'meeting-1',
                    'outsider',
                    MeetingFileKind.ATTACHMENT,
                    makeFile(),
                ),
            ),
        ).rejects.toThrow(NotFoundException);
        expect(prisma.meetingFile.create).not.toHaveBeenCalled();
    });

    it('rejects a disallowed mimetype', async () => {
        await expect(
            handler.execute(
                new UploadMeetingFileCommand(
                    'meeting-1',
                    'user-1',
                    MeetingFileKind.ATTACHMENT,
                    makeFile({ mimetype: 'application/x-msdownload' }),
                ),
            ),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.meetingFile.create).not.toHaveBeenCalled();
    });

    it('rejects a RECORDING kind with a non audio/video mimetype', async () => {
        await expect(
            handler.execute(
                new UploadMeetingFileCommand(
                    'meeting-1',
                    'user-1',
                    MeetingFileKind.RECORDING,
                    makeFile({ mimetype: 'text/plain' }),
                ),
            ),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.meetingFile.create).not.toHaveBeenCalled();
    });

    it('rejects a file exceeding the max upload size', async () => {
        config.get.mockReturnValue('1000');

        await expect(
            handler.execute(
                new UploadMeetingFileCommand(
                    'meeting-1',
                    'user-1',
                    MeetingFileKind.ATTACHMENT,
                    makeFile({ size: 2000 }),
                ),
            ),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.meetingFile.create).not.toHaveBeenCalled();
    });

    it('deletes the just-written file from disk when the DB write fails', async () => {
        const dbError = new Error('connection lost');
        prisma.meetingFile.create.mockRejectedValue(dbError);

        await expect(
            handler.execute(
                new UploadMeetingFileCommand(
                    'meeting-1',
                    'user-1',
                    MeetingFileKind.ATTACHMENT,
                    makeFile(),
                ),
            ),
        ).rejects.toThrow(dbError);

        expect(fs.promises.unlink).toHaveBeenCalledWith(
            '/tmp/storage/meeting-1/uuid-note.txt',
        );
    });
});
