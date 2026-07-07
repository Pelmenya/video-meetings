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
 * POST /auth/register { email, password } -> 201 { accessToken }
 *   - 409 if the email is already registered
 *   - 400 on invalid email / missing or too-short password
 *
 * POST /auth/login { email, password } -> 200 { accessToken }
 *   - 401 for unknown email or wrong password (same status for both, so the
 *     response never reveals whether an account exists)
 *   - 400 on invalid request body
 *
 * accessToken is a JWT whose payload carries `sub` (user id) and `email`.
 */

interface AuthResponseBody {
    accessToken: string;
    password?: unknown;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
    const segments = token.split('.');
    expect(segments).toHaveLength(3);
    return JSON.parse(
        Buffer.from(segments[1], 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
}

function uniqueEmail(): string {
    return `test-${randomUUID()}@example.com`;
}

const VALID_PASSWORD = 'Sup3rSecret!';

describe('Auth (e2e)', () => {
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

    describe('POST /auth/register', () => {
        it('creates a new user and returns an access token', async () => {
            const email = uniqueEmail();

            const res = await request(app.getHttpServer())
                .post('/auth/register')
                .send({ email, password: VALID_PASSWORD })
                .expect(201);

            const body = res.body as AuthResponseBody;
            expect(typeof body.accessToken).toBe('string');
            expect(body.password).toBeUndefined();

            const payload = decodeJwtPayload(body.accessToken);
            expect(payload.email).toBe(email);
            expect(payload.sub).toBeDefined();
        });

        it('rejects registration when the email is already taken', async () => {
            const email = uniqueEmail();

            await request(app.getHttpServer())
                .post('/auth/register')
                .send({ email, password: VALID_PASSWORD })
                .expect(201);

            await request(app.getHttpServer())
                .post('/auth/register')
                .send({ email, password: 'AnotherPass1!' })
                .expect(409);
        });

        it('rejects an invalid email', async () => {
            await request(app.getHttpServer())
                .post('/auth/register')
                .send({ email: 'not-an-email', password: VALID_PASSWORD })
                .expect(400);
        });

        it('rejects a missing email', async () => {
            await request(app.getHttpServer())
                .post('/auth/register')
                .send({ password: VALID_PASSWORD })
                .expect(400);
        });

        it('rejects a missing password', async () => {
            await request(app.getHttpServer())
                .post('/auth/register')
                .send({ email: uniqueEmail() })
                .expect(400);
        });

        it('rejects a password that is too short', async () => {
            await request(app.getHttpServer())
                .post('/auth/register')
                .send({ email: uniqueEmail(), password: '123' })
                .expect(400);
        });
    });

    describe('POST /auth/login', () => {
        it('logs in an existing user and returns an access token', async () => {
            const email = uniqueEmail();

            await request(app.getHttpServer())
                .post('/auth/register')
                .send({ email, password: VALID_PASSWORD })
                .expect(201);

            const res = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email, password: VALID_PASSWORD })
                .expect(200);

            const body = res.body as AuthResponseBody;
            expect(typeof body.accessToken).toBe('string');
            const payload = decodeJwtPayload(body.accessToken);
            expect(payload.email).toBe(email);
        });

        it('rejects an unknown email', async () => {
            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: uniqueEmail(), password: VALID_PASSWORD })
                .expect(401);
        });

        it('rejects an incorrect password', async () => {
            const email = uniqueEmail();

            await request(app.getHttpServer())
                .post('/auth/register')
                .send({ email, password: VALID_PASSWORD })
                .expect(201);

            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email, password: 'WrongPass1!' })
                .expect(401);
        });

        it('rejects an invalid email', async () => {
            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'not-an-email', password: VALID_PASSWORD })
                .expect(400);
        });

        it('rejects a missing email', async () => {
            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ password: VALID_PASSWORD })
                .expect(400);
        });

        it('rejects a missing password', async () => {
            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: uniqueEmail() })
                .expect(400);
        });
    });
});
