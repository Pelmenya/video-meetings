# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

NestJS 11 (Express platform), TypeScript, Jest (ts-jest) for unit tests, a separate Jest config for e2e, ESLint + Prettier, Prisma 6 (ORM, Postgres), `@nestjs/cqrs` for command/event-based use cases, `@nestjs/swagger` for OpenAPI docs, `@nestjs/jwt` + `bcrypt` for auth.

Prisma is pinned to `6.19.2` (not `latest`/7.x): Prisma 7 moved the datasource `url` out of `schema.prisma` into a `prisma.config.ts` + driver-adapter setup (`@prisma/adapter-pg`), a breaking change not worth adopting for this scaffold's needs. Re-evaluate if a future task specifically wants Prisma 7's adapter model.

## Commands

```bash
npm run start        # nest start
npm run start:dev    # nest start --watch (hot reload)
npm run start:debug  # nest start --debug --watch
npm run start:prod   # node dist/main (run after build)
npm run build        # nest build
npm run lint         # eslint --fix on src/apps/libs/test
npm run format       # prettier --write on src/**/*.ts and test/**/*.ts
npm run test         # jest (unit tests, *.spec.ts under src/)
npm run test:watch
npm run test:cov
npm run test:e2e     # jest -c test/jest-e2e.json (*.e2e-spec.ts under test/)
```

Run from this directory, or from the repo root with `-w api` (e.g. `npm run start:dev -w api`).

To run a single test file: `npx jest path/to/file.spec.ts`. To run a single e2e spec: `npx jest --config ./test/jest-e2e.json path/to/file.e2e-spec.ts`.

## Structure

Standard Nest CLI scaffold (`nest-cli.json`, `sourceRoot: src`): `src/main.ts` bootstraps via `NestFactory`, `src/app.module.ts` is the root module. `src/app.setup.ts` exports `configureApp(app)` (global `ValidationPipe`: `whitelist`, `forbidNonWhitelisted`, `transform`) — called from both `main.ts` and every e2e spec's `beforeAll`/`beforeEach`, so tests exercise the same validation behavior as production. Don't set up the `ValidationPipe` directly in `main.ts` only; e2e tests that build the app via `@nestjs/testing` never call `bootstrap()` and would silently skip validation otherwise.

Swagger/OpenAPI is served at `/docs` (`SwaggerModule.setup('docs', ...)` in `main.ts`), generated from DTOs annotated with `@nestjs/swagger`'s `@ApiProperty`.

**Swagger documentation is mandatory for every HTTP endpoint** — not optional, not a follow-up. When adding or changing a controller route:

- `@ApiTags('<resource>')` on the controller.
- `@ApiBearerAuth()` on the controller (or the individual route) whenever it sits behind `JwtAuthGuard`.
- A response decorator on every route matching its actual status code: `@ApiCreatedResponse({ type: ... })` for a `201` (e.g. `POST`), `@ApiOkResponse({ type: ... })` for a `200`, `@ApiNoContentResponse()` for a `204` (e.g. `DELETE`) — don't default to `@ApiOkResponse` for routes that don't actually return `200`.
- Every request/response DTO field annotated with `@ApiProperty()` (or `@ApiPropertyOptional()`-equivalent via `required: false` for optional fields), matching its `class-validator` decorators.

Treat an undocumented or mis-documented (wrong status code, missing DTO type) endpoint the same as a bug — fix it in the same change that adds or touches the route, not later.

- `src/prisma/` — `PrismaModule` (`@Global()`) + `PrismaService` (extends `PrismaClient`, connects/disconnects on module init/destroy). Inject `PrismaService` anywhere; no need to re-import `PrismaModule` per feature module.
- `src/auth/` — authentication only: `POST /auth/register` + `POST /auth/login` endpoints, `TokenService` (JWT signing), and the shared JWT auth guard (see below). Its `RegisterHandler`/`LoginHandler` don't touch Prisma directly — they dispatch `CreateUserCommand`/`VerifyUserCredentialsQuery` into `users` and just wrap the result into a JWT.
- `src/users/` — owns all `User` Prisma access (the only module that calls `prisma.user.*`), exposed purely through CQRS, no HTTP controller of its own: `CreateUserCommand` (hashes + persists, throws on duplicate email, publishes `UserRegisteredEvent`), `VerifyUserCredentialsQuery` (email+password → safe `UserDto` or `null`, bcrypt compare lives here), `FindUsersByIdsQuery` (existence check, used by `meetings` for participant validation). Add a controller here if user-facing profile/management endpoints are ever needed — nothing currently requires one.
- `src/meetings/` — CRUD for meetings (host + participants), authorization example (403 vs 404) for the CQRS pattern below. Validates participant ids via `users`' `FindUsersByIdsQuery` rather than querying Prisma's `User` model itself.
- `src/files/` — owns all `MeetingFile` Prisma access (`prisma.meetingFile.*`), CQRS: `UploadMeetingFileCommand`/handler (validates + saves to disk + creates the DB row), `GetMeetingFilesQuery`/handler (list), `GetMeetingFileContentQuery`/handler (resolves an authorized file's absolute path + metadata for streaming). Authorizes by dispatching `meetings`' `GetMeetingByIdQuery` (which throws `NotFoundException` for a non-host/non-participant) rather than querying `Meeting` directly — `meetings` stays the sole owner of `Meeting` Prisma access. Status is always `READY` at upload time in this phase (a later phase adds the real `QUEUED`/`PROCESSING`/`ERROR` worker lifecycle the schema already supports). See "File uploads (multer)" below.

New modules in general still follow Nest's module/controller/service convention (colocated `.spec.ts` for unit tests, `test/*.e2e-spec.ts` for e2e).

## CQRS pattern (`@nestjs/cqrs`)

`auth` and `meetings` both follow this shape; new modules should too once they have more than trivial logic. A simple CRUD-only module can stay a plain controller+service if CQRS would be pure ceremony — use judgment rather than forcing every module through `CommandBus`.

- **Controllers dispatch only** — no business logic. A controller method builds a Command/Query object and returns `this.commandBus.execute(...)` or `this.queryBus.execute(...)`. See `auth.controller.ts` / `meetings.controller.ts`.
- **Commands** (writes) live in `commands/impl/*.command.ts`. Each extends `@nestjs/cqrs`'s `Command<ResponseDto>` — the generic is what makes `CommandBus.execute()` infer the real return type instead of `unknown`. Constructor args are the plain data the handler needs (e.g. `CreateMeetingCommand(hostId, title, date, participantIds)`); nothing Nest-specific goes on the command itself.
- **Queries** (reads) mirror commands under `queries/impl/*.query.ts`, extending `Query<ResponseDto>`, dispatched via `QueryBus.execute(...)`. Use a query instead of a command for anything that doesn't mutate state (`GetMeetingsQuery`, `GetMeetingByIdQuery`) — keeps read/write intent explicit even though both currently hit Prisma directly rather than separate read models.
- **Handlers** do the actual work (Prisma calls, hashing, token building, authorization checks) — one `@CommandHandler(XCommand)` / `@QueryHandler(XQuery)` class per command/query, each in `commands/handlers/*.handler.ts` or `queries/handlers/*.handler.ts`. Each directory's `index.ts` exports a flat array (`CommandHandlers`, `MeetingCommandHandlers`, `MeetingQueryHandlers`, ...) that the module registers under `providers` alongside `CqrsModule` in `imports`. Nest resolves `@CommandHandler`/`@QueryHandler` decorators from that providers list, not from a separate registration step.
- **Events** are for side effects that shouldn't block the primary response — `events/impl/*.event.ts` (plain data classes) + `events/handlers/*.handler.ts` (`@EventsHandler`), published from inside a command handler via `EventBus.publish(new XEvent(...))` after the main write succeeds. `users`' `CreateUserHandler` publishes `UserRegisteredEvent` this way (handler just logs today; it's the extension point for a welcome email, analytics, etc. later) — `auth`'s `RegisterHandler` just dispatches `CreateUserCommand` and doesn't know the event exists. Not every command needs an event — add one when something should react to the write without living in the handler itself.
- **Cross-request concerns don't belong in commands/queries.** Authentication (who is calling) is a guard (`JwtAuthGuard`, see below); authorization that depends on loaded data (e.g. "is this user the meeting's host or just a participant?") lives in the handler, via a shared helper (`meetings/meeting-access.ts`'s `assertHostOrParticipant`/`assertHost`) rather than duplicated per handler. `meetings`' rule of thumb: check `assertHostOrParticipant` first (unrelated users get 404, not leaking that the resource exists), then `assertHost` for mutating actions (a related-but-non-host participant gets 403, since they already know it exists).
- **DTO/mapper split**: request shape lives in `dto/*.dto.ts` (class-validator + `@ApiProperty`), the Prisma-row-to-response-shape conversion lives in a small mapper (`meetings/meeting.mapper.ts`'s `toMeetingResponse`) rather than inline in every handler — keeps the `include`/`select` shape (`MEETING_WITH_PARTICIPANTS`) consistent across create/update/get handlers.
- **User-facing message locale is Russian.** `class-validator` decorators (`@IsEmail`, `@MinLength`, etc.) and hand-thrown exceptions (e.g. `users`' `CreateUserHandler` throwing `ConflictException` for a duplicate email) must pass an explicit Russian `message` — `apps/web`'s UI is in Russian and surfaces these strings directly (via `ApiError.messages`), so leaving a decorator's default kicks in class-validator's English fallback and produces a mixed-language error next to Russian labels. See `auth/dto/register.dto.ts` for the pattern.

### Shared JWT auth guard

`src/auth/guards/jwt-auth.guard.ts` (`JwtAuthGuard`) verifies the `Authorization: Bearer <token>` header directly via the existing `JwtService` (`jwtService.verifyAsync`) — there's no `@nestjs/passport`/`passport-jwt` in this project; adding that dependency wasn't worth it for one guard. On success it stamps `request.user = { userId, email }`; `src/auth/decorators/current-user.decorator.ts`'s `@CurrentUser()` param decorator reads it back out. `AuthModule` exports both `JwtModule` and `JwtAuthGuard` so other feature modules (e.g. `MeetingsModule`) can `imports: [AuthModule]` and use `@UseGuards(JwtAuthGuard)` + `@CurrentUser()` without re-registering JWT config. Apply the guard at the controller level (`@UseGuards(JwtAuthGuard)` above `@Controller(...)`) unless a route genuinely needs to be public.

## Database (Prisma)

- Schema: `prisma/schema.prisma` — `User { id, email (unique), password, createdAt, updatedAt }` (table `users`), `Meeting { id, title, date, status (MeetingStatus enum: SCHEDULED/ONGOING/ENDED/CANCELLED, default SCHEDULED), hostId, createdAt, updatedAt }` (table `meetings`), with `hostId` -> `User` (`onDelete` default `Restrict`) and an implicit many-to-many `participants: User[]` <-> `Meeting[]`; and `MeetingFile { id, kind (MeetingFileKind: RECORDING/ATTACHMENT), originalName, mimeType, sizeBytes (Int — ~2GB ceiling, fine at the current upload size cap but revisit if that cap ever grows), storagePath (relative to `FILE_STORAGE_ROOT`, never the absolute path), status (MeetingFileStatus: QUEUED/PROCESSING/READY/ERROR, default QUEUED), errorMessage, meetingId (`onDelete: Cascade`), uploaderId, createdAt, updatedAt }` (table `meeting_files`).
- `apps/api/.env` (gitignored; copy `.env.example`) needs `DATABASE_URL` (points at the root `docker-compose.yml` Postgres — host `localhost`, port `5435`, matching the root `.env`'s `POSTGRES_*` values) plus `JWT_SECRET` and `JWT_EXPIRES_IN` (seconds — `@nestjs/jwt`'s `signOptions.expiresIn` wants `number | ms.StringValue`, not an arbitrary string, so keep this numeric). It also sets `PORT` (`3001` — `apps/web`'s dev server defaults to `3000`, so the API must bind elsewhere), `CORS_ORIGIN` (`http://localhost:3000`, read by `main.ts`'s `app.enableCors(...)` so the web app's cross-origin `fetch` calls aren't blocked), `FILE_STORAGE_ROOT` (local disk directory for uploaded meeting files, resolved relative to `process.cwd()`, gitignored — see "File uploads (multer)" below) and `MAX_UPLOAD_SIZE_BYTES` (hard cap on a single upload, in bytes).
- After changing `schema.prisma`: `npx prisma migrate dev --name <description>` (applies to the dev Postgres from `npm run db:up` and regenerates the client). `npx prisma generate` alone is enough after a fresh `npm install` wipes `node_modules` (the generated client lives under `node_modules/@prisma/client` and doesn't survive a clean reinstall). On Windows, a stray `node dist/main.js` (or any process with the old Prisma client loaded) can hold the generated query-engine `.dll.node` locked, making `generate` fail with `EPERM: operation not permitted, rename ...`; stop that process first.
- e2e tests (`test/auth.e2e-spec.ts`, `test/meetings.e2e-spec.ts`, `test/meeting-files.e2e-spec.ts`) run against the real dev Postgres, not a mock — isolation comes from generating a unique email per test (`randomUUID()`-based) rather than resetting the database between runs, so registering a throwaway user via `POST /auth/register` is the standard way to get an `accessToken` (and, by decoding its JWT payload, a `userId`) for an authenticated request in any new e2e spec.

## File uploads (multer)

`src/files/` handles `POST /meetings/:id/files` (multipart), `GET /meetings/:id/files` (list), `GET /meetings/:id/files/:fileId/content` (streamed, `Range`-aware).

- **Memory storage, not disk storage**: `FileInterceptor('file', { limits: { fileSize } })` uses multer's default `MemoryStorage`, giving the handler `file.buffer` — deliberate so the command handler (not an interceptor closure) owns "validate, then persist to disk, then persist to DB" as one unit-testable place, and so a rejected upload never touches the filesystem. Trade-off: the whole file is buffered in memory before validation; acceptable at the current 500MB default cap, revisit (streamed disk writes) if that cap grows substantially.
- **Two-layer size enforcement, by design**: the command handler (`upload-meeting-file.handler.ts`) does the real, user-facing `400` rejection (Russian message) by comparing `file.size` against `MAX_UPLOAD_SIZE_BYTES` — this is the only layer the project's handler-unit-test convention can exercise directly. Multer's own `limits.fileSize` on `FileInterceptor` is a resource-protection backstop only (stops an oversized body from being fully buffered before the handler gets a chance to reject it); when multer itself rejects, it throws a `MulterError`, caught by the route-scoped `MulterExceptionFilter` (`multer-exception.filter.ts`) so that path also returns a clean Russian `400` instead of Nest's default 500.
- **MIME allow-lists** (`upload.constants.ts`: `ALLOWED_RECORDING_MIME_TYPES`, `ALLOWED_ATTACHMENT_MIME_TYPES`) are checked in the handler, keyed off the multipart `kind` field (`RECORDING`/`ATTACHMENT`, sent explicitly by the client — not inferred from mimetype, since an audio file can legitimately be an attachment rather than the meeting's own recording). Multer's `fileFilter` is deliberately not used for this, to keep one source of truth.
- **One documented exception to "always use `ConfigService`"**: `@UseInterceptors(FileInterceptor('file', { limits: { fileSize: getMaxUploadSizeBytes() } }))`'s argument is evaluated at class-decoration time (module load), before Nest's DI container exists, so `getMaxUploadSizeBytes()` (`upload.constants.ts`) reads `process.env.MAX_UPLOAD_SIZE_BYTES` directly instead. Every other read of this value (the handler's real validation) goes through `ConfigService` as usual.
- **Storage path scheme**: `saveFileToDisk` (`storage.util.ts`) writes to `<FILE_STORAGE_ROOT>/<meetingId>/<uuid>-<sanitizedOriginalName>` and the DB's `storagePath` stores that path **relative to `FILE_STORAGE_ROOT`**, not absolute — keeps the DB portable across environments where the storage root differs. `MeetingFileResponseDto` never exposes `storagePath` (avoids leaking server filesystem layout).
- **Range-request streaming**: `GET .../content` uses `@Res({ passthrough: true })` + `StreamableFile` (not full manual-mode `@Res()`, which would disable Nest's interceptors/exception filters for that route) — the controller parses the `Range` header itself and sets `206`/`Content-Range` headers, since HTTP wire-protocol concerns don't belong in a query handler (same principle as authorization living in the handler, not the controller, just inverted: here the *handler* returns plain data — `{ absolutePath, mimeType, sizeBytes, originalName }` — and the *controller* does the streaming).
- Access control reuses `meetings`' `assertHostOrParticipant` indirectly: every files handler dispatches `GetMeetingByIdQuery` via `QueryBus` rather than duplicating the check or querying `Meeting` directly.

## Formatting

`.prettierrc` (`singleQuote`, `trailingComma: "all"`, `tabWidth: 4`) mirrors `apps/web`'s — keep them in sync. A repo-wide Claude Code hook (see root `CLAUDE.md`) runs Prettier automatically after edits — you shouldn't need to run `npm run format` manually in normal use.

## Keeping documentation current

Update this file whenever a change affects what it describes (stack, scripts, structure/conventions) — in the same change, not as a follow-up. See the root `CLAUDE.md` for the repo-wide policy.
