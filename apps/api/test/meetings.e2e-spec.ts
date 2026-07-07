import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

/**
 * Contract under test (no implementation exists yet — this suite is the spec):
 *
 * All /meetings routes require `Authorization: Bearer <accessToken>` from
 * POST /auth/register|login -> 401 if the header is missing or the token is
 * invalid/malformed.
 *
 * A Meeting has: id, title, date (ISO string), status (defaults to
 * "SCHEDULED"), hostId (the authenticated creator, never taken from the
 * request body), participants (array of existing User ids, defaults to []
 * when omitted), createdAt, updatedAt.
 *
 * POST /meetings { title, date, participants? } -> 201 Meeting
 *   - 400 if title is missing/empty
 *   - 400 if date is missing/not a valid date string
 *   - 400 if participants is present but not an array of strings
 *   - 400 if any participant id does not correspond to an existing user
 *   - 400 if the body contains an unrecognized field such as "hostId"
 *     (global ValidationPipe whitelist) — the host is always the caller,
 *     taken from the JWT, never from the request body
 *
 * GET /meetings -> 200 Meeting[]
 *   - returns meetings where the caller is host OR a participant
 *   - never returns meetings the caller has no relation to
 *
 * GET /meetings/:id -> 200 Meeting
 *   - visible to the host and to any participant
 *   - 400 if :id is not a valid UUID
 *   - 404 if the meeting does not exist, or the caller is neither host nor
 *     participant (existence is not leaked to unrelated users)
 *
 * PATCH /meetings/:id { title?, date?, participants?, status? } -> 200 Meeting
 *   - only the host may update; a non-host participant gets 403
 *   - 400 for the same validation rules as POST, on whichever fields are sent
 *   - 400 if :id is not a valid UUID
 *   - 404 if the meeting does not exist, or the caller is neither host nor
 *     participant
 *
 * DELETE /meetings/:id -> 204
 *   - only the host may delete; a non-host participant gets 403
 *   - 400 if :id is not a valid UUID
 *   - 404 if the meeting does not exist, or the caller is neither host nor
 *     participant
 *   - the meeting is actually gone afterwards (subsequent GET -> 404)
 */

interface MeetingBody {
    id: string;
    title: string;
    date: string;
    status: string;
    hostId: string;
    participants: string[];
    createdAt?: string;
    updatedAt?: string;
    password?: unknown;
}

const VALID_PASSWORD = 'Sup3rSecret!';
const NON_EXISTENT_UUID = '00000000-0000-4000-8000-000000000000';
const INVALID_UUID = 'not-a-uuid';

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

describe('Meetings (e2e)', () => {
    let app: INestApplication<App>;

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

    function authed(method: 'get' | 'post' | 'patch' | 'delete', url: string) {
        return (token: string) =>
            request(app.getHttpServer())
                [method](url)
                .set('Authorization', `Bearer ${token}`);
    }

    describe('POST /meetings', () => {
        it('rejects a request with no Authorization header', async () => {
            await request(app.getHttpServer())
                .post('/meetings')
                .send({ title: 'Standup', date: futureDate() })
                .expect(401);
        });

        it('rejects a request with an invalid token', async () => {
            await request(app.getHttpServer())
                .post('/meetings')
                .set('Authorization', 'Bearer not-a-real-token')
                .send({ title: 'Standup', date: futureDate() })
                .expect(401);
        });

        it('creates a meeting hosted by the caller, with no participants by default', async () => {
            const host = await registerUser();
            const date = futureDate();

            const res = await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({ title: 'Standup', date })
                .expect(201);

            const body = res.body as MeetingBody;
            expect(body.id).toBeDefined();
            expect(body.title).toBe('Standup');
            expect(new Date(body.date).toISOString()).toBe(date);
            expect(body.status).toBe('SCHEDULED');
            expect(body.hostId).toBe(host.userId);
            expect(body.participants).toEqual([]);
        });

        it('creates a meeting with participants that are existing users', async () => {
            const host = await registerUser();
            const alice = await registerUser();
            const bob = await registerUser();

            const res = await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({
                    title: 'Planning',
                    date: futureDate(),
                    participants: [alice.userId, bob.userId],
                })
                .expect(201);

            const body = res.body as MeetingBody;
            expect(body.hostId).toBe(host.userId);
            expect(new Set(body.participants)).toEqual(
                new Set([alice.userId, bob.userId]),
            );
        });

        it('rejects an unrecognized hostId field in the body (whitelist validation)', async () => {
            const host = await registerUser();
            const someoneElse = await registerUser();

            await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({
                    title: 'Standup',
                    date: futureDate(),
                    hostId: someoneElse.userId,
                })
                .expect(400);
        });

        it('rejects a missing title', async () => {
            const host = await registerUser();
            await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({ date: futureDate() })
                .expect(400);
        });

        it('rejects an empty title', async () => {
            const host = await registerUser();
            await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({ title: '', date: futureDate() })
                .expect(400);
        });

        it('rejects a missing date', async () => {
            const host = await registerUser();
            await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({ title: 'Standup' })
                .expect(400);
        });

        it('rejects an invalid date', async () => {
            const host = await registerUser();
            await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({ title: 'Standup', date: 'not-a-date' })
                .expect(400);
        });

        it('rejects participants that is not an array', async () => {
            const host = await registerUser();
            await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({
                    title: 'Standup',
                    date: futureDate(),
                    participants: 'not-an-array',
                })
                .expect(400);
        });

        it('rejects a participant id that does not correspond to an existing user', async () => {
            const host = await registerUser();
            await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({
                    title: 'Standup',
                    date: futureDate(),
                    participants: [randomUUID()],
                })
                .expect(400);
        });
    });

    describe('GET /meetings', () => {
        it('rejects a request with no Authorization header', async () => {
            await request(app.getHttpServer()).get('/meetings').expect(401);
        });

        it('returns an empty list for a user with no meetings', async () => {
            const user = await registerUser();
            const res = await authed(
                'get',
                '/meetings',
            )(user.accessToken).expect(200);

            expect(res.body).toEqual([]);
        });

        it('returns meetings the caller hosts', async () => {
            const host = await registerUser();
            const created = await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({ title: 'Standup', date: futureDate() })
                .expect(201);

            const res = await authed(
                'get',
                '/meetings',
            )(host.accessToken).expect(200);

            const ids = (res.body as MeetingBody[]).map((m) => m.id);
            expect(ids).toContain((created.body as MeetingBody).id);
        });

        it('returns meetings the caller participates in but does not host', async () => {
            const host = await registerUser();
            const participant = await registerUser();
            const created = await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({
                    title: 'Planning',
                    date: futureDate(),
                    participants: [participant.userId],
                })
                .expect(201);

            const res = await authed(
                'get',
                '/meetings',
            )(participant.accessToken).expect(200);

            const ids = (res.body as MeetingBody[]).map((m) => m.id);
            expect(ids).toContain((created.body as MeetingBody).id);
        });

        it('does not return meetings the caller has no relation to', async () => {
            const host = await registerUser();
            const outsider = await registerUser();
            const created = await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({ title: 'Private', date: futureDate() })
                .expect(201);

            const res = await authed(
                'get',
                '/meetings',
            )(outsider.accessToken).expect(200);

            const ids = (res.body as MeetingBody[]).map((m) => m.id);
            expect(ids).not.toContain((created.body as MeetingBody).id);
        });
    });

    describe('GET /meetings/:id', () => {
        it('rejects a request with no Authorization header', async () => {
            await request(app.getHttpServer())
                .get(`/meetings/${NON_EXISTENT_UUID}`)
                .expect(401);
        });

        it('rejects an id that is not a valid UUID', async () => {
            const user = await registerUser();
            await authed(
                'get',
                `/meetings/${INVALID_UUID}`,
            )(user.accessToken).expect(400);
        });

        it('returns 404 for a well-formed id that does not exist', async () => {
            const user = await registerUser();
            await authed(
                'get',
                `/meetings/${NON_EXISTENT_UUID}`,
            )(user.accessToken).expect(404);
        });

        it('lets the host fetch the meeting', async () => {
            const host = await registerUser();
            const created = await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({ title: 'Standup', date: futureDate() })
                .expect(201);
            const id = (created.body as MeetingBody).id;

            const res = await authed(
                'get',
                `/meetings/${id}`,
            )(host.accessToken).expect(200);

            expect((res.body as MeetingBody).id).toBe(id);
        });

        it('lets a participant fetch the meeting', async () => {
            const host = await registerUser();
            const participant = await registerUser();
            const created = await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({
                    title: 'Standup',
                    date: futureDate(),
                    participants: [participant.userId],
                })
                .expect(201);
            const id = (created.body as MeetingBody).id;

            await authed(
                'get',
                `/meetings/${id}`,
            )(participant.accessToken).expect(200);
        });

        it('returns 404 for a user who is neither host nor participant', async () => {
            const host = await registerUser();
            const outsider = await registerUser();
            const created = await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({ title: 'Private', date: futureDate() })
                .expect(201);
            const id = (created.body as MeetingBody).id;

            await authed(
                'get',
                `/meetings/${id}`,
            )(outsider.accessToken).expect(404);
        });
    });

    describe('PATCH /meetings/:id', () => {
        it('rejects a request with no Authorization header', async () => {
            await request(app.getHttpServer())
                .patch(`/meetings/${NON_EXISTENT_UUID}`)
                .send({ title: 'New title' })
                .expect(401);
        });

        it('rejects an id that is not a valid UUID', async () => {
            const user = await registerUser();
            await authed(
                'patch',
                `/meetings/${INVALID_UUID}`,
            )(user.accessToken)
                .send({ title: 'New title' })
                .expect(400);
        });

        it('returns 404 for a well-formed id that does not exist', async () => {
            const user = await registerUser();
            await authed(
                'patch',
                `/meetings/${NON_EXISTENT_UUID}`,
            )(user.accessToken)
                .send({ title: 'New title' })
                .expect(404);
        });

        it('lets the host update the title, leaving other fields unchanged', async () => {
            const host = await registerUser();
            const date = futureDate();
            const created = await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({ title: 'Standup', date })
                .expect(201);
            const id = (created.body as MeetingBody).id;

            const res = await authed(
                'patch',
                `/meetings/${id}`,
            )(host.accessToken)
                .send({ title: 'Renamed standup' })
                .expect(200);

            const body = res.body as MeetingBody;
            expect(body.title).toBe('Renamed standup');
            expect(new Date(body.date).toISOString()).toBe(date);
        });

        it('lets the host update date, participants and status together', async () => {
            const host = await registerUser();
            const participant = await registerUser();
            const created = await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({ title: 'Standup', date: futureDate() })
                .expect(201);
            const id = (created.body as MeetingBody).id;
            const newDate = futureDate();

            const res = await authed(
                'patch',
                `/meetings/${id}`,
            )(host.accessToken)
                .send({
                    date: newDate,
                    participants: [participant.userId],
                    status: 'CANCELLED',
                })
                .expect(200);

            const body = res.body as MeetingBody;
            expect(new Date(body.date).toISOString()).toBe(newDate);
            expect(body.participants).toEqual([participant.userId]);
            expect(body.status).toBe('CANCELLED');
        });

        it('rejects an invalid date on update', async () => {
            const host = await registerUser();
            const created = await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({ title: 'Standup', date: futureDate() })
                .expect(201);
            const id = (created.body as MeetingBody).id;

            await authed(
                'patch',
                `/meetings/${id}`,
            )(host.accessToken)
                .send({ date: 'not-a-date' })
                .expect(400);
        });

        it('rejects an unknown participant id on update', async () => {
            const host = await registerUser();
            const created = await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({ title: 'Standup', date: futureDate() })
                .expect(201);
            const id = (created.body as MeetingBody).id;

            await authed(
                'patch',
                `/meetings/${id}`,
            )(host.accessToken)
                .send({ participants: [randomUUID()] })
                .expect(400);
        });

        it('returns 403 when a non-host participant tries to update', async () => {
            const host = await registerUser();
            const participant = await registerUser();
            const created = await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({
                    title: 'Standup',
                    date: futureDate(),
                    participants: [participant.userId],
                })
                .expect(201);
            const id = (created.body as MeetingBody).id;

            await authed(
                'patch',
                `/meetings/${id}`,
            )(participant.accessToken)
                .send({ title: 'Hijacked' })
                .expect(403);
        });

        it('returns 404 when the caller is neither host nor participant', async () => {
            const host = await registerUser();
            const outsider = await registerUser();
            const created = await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({ title: 'Private', date: futureDate() })
                .expect(201);
            const id = (created.body as MeetingBody).id;

            await authed(
                'patch',
                `/meetings/${id}`,
            )(outsider.accessToken)
                .send({ title: 'Hijacked' })
                .expect(404);
        });
    });

    describe('DELETE /meetings/:id', () => {
        it('rejects a request with no Authorization header', async () => {
            await request(app.getHttpServer())
                .delete(`/meetings/${NON_EXISTENT_UUID}`)
                .expect(401);
        });

        it('rejects an id that is not a valid UUID', async () => {
            const user = await registerUser();
            await authed(
                'delete',
                `/meetings/${INVALID_UUID}`,
            )(user.accessToken).expect(400);
        });

        it('returns 404 for a well-formed id that does not exist', async () => {
            const user = await registerUser();
            await authed(
                'delete',
                `/meetings/${NON_EXISTENT_UUID}`,
            )(user.accessToken).expect(404);
        });

        it('returns 403 when a non-host participant tries to delete', async () => {
            const host = await registerUser();
            const participant = await registerUser();
            const created = await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({
                    title: 'Standup',
                    date: futureDate(),
                    participants: [participant.userId],
                })
                .expect(201);
            const id = (created.body as MeetingBody).id;

            await authed(
                'delete',
                `/meetings/${id}`,
            )(participant.accessToken).expect(403);
        });

        it('returns 404 when the caller is neither host nor participant', async () => {
            const host = await registerUser();
            const outsider = await registerUser();
            const created = await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({ title: 'Private', date: futureDate() })
                .expect(201);
            const id = (created.body as MeetingBody).id;

            await authed(
                'delete',
                `/meetings/${id}`,
            )(outsider.accessToken).expect(404);
        });

        it('lets the host delete the meeting, after which it is gone', async () => {
            const host = await registerUser();
            const created = await authed(
                'post',
                '/meetings',
            )(host.accessToken)
                .send({ title: 'Standup', date: futureDate() })
                .expect(201);
            const id = (created.body as MeetingBody).id;

            await authed(
                'delete',
                `/meetings/${id}`,
            )(host.accessToken).expect(204);

            await authed(
                'get',
                `/meetings/${id}`,
            )(host.accessToken).expect(404);
        });
    });
});
