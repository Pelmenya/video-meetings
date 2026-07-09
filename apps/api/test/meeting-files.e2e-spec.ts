import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { DEFAULT_FILE_STORAGE_ROOT } from './../src/files/upload.constants';

/**
 * Contract under test:
 *
 * POST /meetings/:id/files (multipart: kind, file) -> 201 MeetingFile
 *   - 400 for a disallowed mimetype
 *   - 404 for a caller who is neither host nor participant of the meeting
 *   - response never exposes storagePath
 *   - status is always READY in this phase
 *
 * GET /meetings/:id/files -> 200 MeetingFile[]
 *   - lists files uploaded to the meeting
 *   - 404 for a caller who is neither host nor participant
 *
 * GET /meetings/:id/files/:fileId/content -> 200 (or 206 for a Range request)
 *   - body matches the uploaded bytes
 *   - supports the Range header for partial content
 *   - 404 for a caller who is neither host nor participant
 */

const VALID_PASSWORD = 'Sup3rSecret!';
const NON_EXISTENT_UUID = '00000000-0000-4000-8000-000000000000';

function uniqueEmail(): string {
    return `test-${randomUUID()}@example.com`;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
    const segments = token.split('.');
    expect(segments).toHaveLength(3);
    return JSON.parse(
        Buffer.from(segments[1], 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
}

function futureDate(): string {
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

interface MeetingFileBody {
    id: string;
    meetingId: string;
    uploaderId: string;
    kind: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    status: string;
    errorMessage: string | null;
    storagePath?: unknown;
}

describe('Meeting files (e2e)', () => {
    let app: INestApplication<App>;
    const createdMeetingIds: string[] = [];

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        configureApp(app);
        await app.init();
    });

    afterAll(async () => {
        await app.close();

        const storageRoot = path.resolve(
            process.cwd(),
            process.env.FILE_STORAGE_ROOT ?? DEFAULT_FILE_STORAGE_ROOT,
        );
        await Promise.all(
            createdMeetingIds.map((meetingId) =>
                fs.promises.rm(path.join(storageRoot, meetingId), {
                    recursive: true,
                    force: true,
                }),
            ),
        );
    });

    async function registerUser(): Promise<{
        email: string;
        accessToken: string;
        userId: string;
    }> {
        const email = uniqueEmail();
        const res = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ email, password: VALID_PASSWORD })
            .expect(201);

        const accessToken = (res.body as { accessToken: string }).accessToken;
        const userId = decodeJwtPayload(accessToken).sub as string;
        return { email, accessToken, userId };
    }

    async function createMeeting(
        accessToken: string,
        participants: string[] = [],
    ): Promise<string> {
        const res = await request(app.getHttpServer())
            .post('/meetings')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ title: 'Standup', date: futureDate(), participants })
            .expect(201);

        const meetingId = (res.body as { id: string }).id;
        createdMeetingIds.push(meetingId);
        return meetingId;
    }

    it('lets a participant upload a file, list it, and stream its content back', async () => {
        const host = await registerUser();
        const participant = await registerUser();
        const meetingId = await createMeeting(host.accessToken, [
            participant.userId,
        ]);
        const content = 'hello world from an uploaded attachment';

        const uploadRes = await request(app.getHttpServer())
            .post(`/meetings/${meetingId}/files`)
            .set('Authorization', `Bearer ${participant.accessToken}`)
            .field('kind', 'ATTACHMENT')
            .attach('file', Buffer.from(content), {
                filename: 'note.txt',
                contentType: 'text/plain',
            })
            .expect(201);

        const uploaded = uploadRes.body as MeetingFileBody;
        expect(uploaded.originalName).toBe('note.txt');
        expect(uploaded.mimeType).toBe('text/plain');
        expect(uploaded.kind).toBe('ATTACHMENT');
        expect(uploaded.status).toBe('READY');
        expect(uploaded.sizeBytes).toBe(Buffer.byteLength(content));
        expect(uploaded.storagePath).toBeUndefined();

        const listRes = await request(app.getHttpServer())
            .get(`/meetings/${meetingId}/files`)
            .set('Authorization', `Bearer ${host.accessToken}`)
            .expect(200);

        const files = listRes.body as MeetingFileBody[];
        expect(files.map((f) => f.id)).toContain(uploaded.id);

        const contentRes = await request(app.getHttpServer())
            .get(`/meetings/${meetingId}/files/${uploaded.id}/content`)
            .set('Authorization', `Bearer ${host.accessToken}`)
            .expect(200);

        expect(contentRes.text).toBe(content);

        const rangeRes = await request(app.getHttpServer())
            .get(`/meetings/${meetingId}/files/${uploaded.id}/content`)
            .set('Authorization', `Bearer ${host.accessToken}`)
            .set('Range', 'bytes=0-4')
            .expect(206);

        expect(rangeRes.text).toBe(content.slice(0, 5));
        expect(rangeRes.headers['content-range']).toBe(
            `bytes 0-4/${Buffer.byteLength(content)}`,
        );
    });

    it('lets a participant upload a RECORDING (audio/video) file', async () => {
        const host = await registerUser();
        const meetingId = await createMeeting(host.accessToken);

        const uploadRes = await request(app.getHttpServer())
            .post(`/meetings/${meetingId}/files`)
            .set('Authorization', `Bearer ${host.accessToken}`)
            .field('kind', 'RECORDING')
            .attach('file', Buffer.from('fake mp4 bytes'), {
                filename: 'call.mp4',
                contentType: 'video/mp4',
            })
            .expect(201);

        const uploaded = uploadRes.body as MeetingFileBody;
        expect(uploaded.kind).toBe('RECORDING');
        expect(uploaded.mimeType).toBe('video/mp4');
        expect(uploaded.status).toBe('READY');
    });

    it('rejects a RECORDING upload with a non audio/video mimetype', async () => {
        const host = await registerUser();
        const meetingId = await createMeeting(host.accessToken);

        await request(app.getHttpServer())
            .post(`/meetings/${meetingId}/files`)
            .set('Authorization', `Bearer ${host.accessToken}`)
            .field('kind', 'RECORDING')
            .attach('file', Buffer.from('hello'), {
                filename: 'note.txt',
                contentType: 'text/plain',
            })
            .expect(400);
    });

    it('rejects an upload with a missing or invalid kind field', async () => {
        const host = await registerUser();
        const meetingId = await createMeeting(host.accessToken);

        await request(app.getHttpServer())
            .post(`/meetings/${meetingId}/files`)
            .set('Authorization', `Bearer ${host.accessToken}`)
            .attach('file', Buffer.from('hi'), {
                filename: 'note.txt',
                contentType: 'text/plain',
            })
            .expect(400);

        await request(app.getHttpServer())
            .post(`/meetings/${meetingId}/files`)
            .set('Authorization', `Bearer ${host.accessToken}`)
            .field('kind', 'NOT_A_REAL_KIND')
            .attach('file', Buffer.from('hi'), {
                filename: 'note.txt',
                contentType: 'text/plain',
            })
            .expect(400);
    });

    it('rejects an upload with a disallowed mimetype', async () => {
        const host = await registerUser();
        const meetingId = await createMeeting(host.accessToken);

        await request(app.getHttpServer())
            .post(`/meetings/${meetingId}/files`)
            .set('Authorization', `Bearer ${host.accessToken}`)
            .field('kind', 'ATTACHMENT')
            .attach('file', Buffer.from('bad'), {
                filename: 'virus.exe',
                contentType: 'application/x-msdownload',
            })
            .expect(400);
    });

    it('returns 404 for upload/list/content when the caller has no relation to the meeting', async () => {
        const host = await registerUser();
        const outsider = await registerUser();
        const meetingId = await createMeeting(host.accessToken);

        await request(app.getHttpServer())
            .post(`/meetings/${meetingId}/files`)
            .set('Authorization', `Bearer ${outsider.accessToken}`)
            .field('kind', 'ATTACHMENT')
            .attach('file', Buffer.from('hi'), {
                filename: 'note.txt',
                contentType: 'text/plain',
            })
            .expect(404);

        await request(app.getHttpServer())
            .get(`/meetings/${meetingId}/files`)
            .set('Authorization', `Bearer ${outsider.accessToken}`)
            .expect(404);

        await request(app.getHttpServer())
            .get(`/meetings/${meetingId}/files/${NON_EXISTENT_UUID}/content`)
            .set('Authorization', `Bearer ${outsider.accessToken}`)
            .expect(404);
    });

    it('returns 404 for a well-formed but non-existent file id', async () => {
        const host = await registerUser();
        const meetingId = await createMeeting(host.accessToken);

        await request(app.getHttpServer())
            .get(`/meetings/${meetingId}/files/${NON_EXISTENT_UUID}/content`)
            .set('Authorization', `Bearer ${host.accessToken}`)
            .expect(404);
    });
});
