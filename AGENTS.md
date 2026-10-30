# Agent instructions

Cross-tool standing rules for this repo. Read by Cursor, Codex, Antigravity, Copilot, and other agents that support `AGENTS.md`. Claude Code loads this via root `CLAUDE.md` (`@AGENTS.md`).

## Database migrations — do not run without permission

**Never** run database migrations unless the user **explicitly** asks in that message (examples: "run migration", "migrate deploy", "apply migrations").

Blocked without an explicit ask:

- `prisma migrate deploy` / `prisma migrate dev` / `prisma migrate reset` / `prisma db push`
- Any other tool that applies schema changes (Flyway, Liquibase, Knex, TypeORM, Django, Rails, Alembic, etc.)

Still allowed:

- Writing migration files / Prisma schema changes while building a feature
- `prisma generate` when types are needed

If a migration is required: say so and **wait**. Do not treat "deploy", "finish setup", or "make it work" as permission to migrate.

## NestJS backend (`server/src/nest/**`)

Express → Nest migration (strangler fig, same process): Nest is mounted on the existing Express app via `ExpressAdapter`. Global Express middleware (tenant, RLS context, auth) still runs before Nest routes.

### Migration rules

- New modules: Nest only (`server/src/nest/modules/<name>/`). Legacy Express (`server/src/modules/**`) is frozen: bug fixes only, no new routes.
- Each path lives in exactly one stack. When migrating a module, delete its legacy route, controller and service and unmount the router in `server.ts`, all in the same change.
- Moving a module = rename its endpoints to REST (see below) and update every frontend caller (`dashboard/`, `client-next/`) in the same change.
- No alias routes: old paths are removed in the same change and every caller (dashboard, client-next, dashboard-expo, workers) moves with it. Each moved module ships `<module>.http.spec.ts` next to it (see Tests).
- Super-admin routes that must run without a school go under `/api/platform/*` (pre-tenant, see `src/middlewares/pre-tenant-routes.ts`) with `Auth('super_admin')`; never read `@SchoolId()` there.

### Module layout

Related modules are grouped by domain in a subfolder with a parent module that imports its children (`modules/accounts/accounts.module.ts`, `modules/fees/fees.module.ts`; `app.module.ts` imports only the parent). Standalone modules stay at `modules/<name>/`. Each module inside keeps the layout below.

```
nest/modules/[<group>/]<name>/
  dto/create-<name>.dto.ts
  dto/update-<name>.dto.ts      # PartialType(Create...)
  dto/<name>.dto.spec.ts
  <name>.controller.ts
  <name>.service.ts
  <name>.service.spec.ts
  <name>.http.spec.ts
  <name>.module.ts              # registered in app.module.ts
```

Shared Nest pieces live in `nest/common/` (auth guard, `@SchoolId()`, Prisma module, error filter, response interceptor). Tests sit next to the code they test, not in a separate `test/` folder.

### Code rules

- Use Nest built-ins first; no unnecessary code. No custom helpers/wrappers where Nest already provides one: `ParseIntPipe` for `:id` params, built-in exceptions (`NotFoundException`, `BadRequestException`, ...) instead of `ApiError`, `@HttpCode`, guards, pipes, interceptors, `createParamDecorator`. Controllers never use `ApiResponse`/`ApiError`.
- Success responses are wrapped globally by `ResponseInterceptor` as `{ success: true, data }`. Controllers just return the value. No per-route message decorators.
- Global `/api` prefix is set in `bootstrap.ts`; controllers use `@Controller('holidays')`, not `api/holidays`.
- REST routes: resource-noun paths, verbs via HTTP method. `GET /holidays`, `GET /holidays/:id`, `POST /holidays`, `PATCH /holidays/:id` (partial update), `DELETE /holidays/:id`. No verbs in paths (`getHolidays`, `addHoliday`). Handlers named `findAll`/`findOne`/`create`/`update`/`remove`.
- Auth: `@UseGuards(Auth('admin'))` (wraps the legacy auth middleware). Guards run before pipes, so unauthenticated requests get 401 before body validation.
- Request bodies (standard): validate with the shared zod schema from `@school/shared-schemas` via `@Body(new ZodBodyPipe(schema))` (`server/src/nest/common/zod-body.pipe.ts`; invalid → 400, the handler gets the parsed data). If no schema exists, add one to `packages/shared-schemas` so the frontend forms and the server share it. Use `.strict()` on the schema when unknown fields must be rejected (zod strips them by default).
- Legacy: existing `class-validator` DTOs in `dto/` (validated by the global `ValidationPipe({ whitelist, forbidNonWhitelisted })` in `bootstrap.ts`, `PartialType` for updates, fields use `!`) stay as they are and move to zod gradually, when a route is touched anyway. Do not convert them in bulk. Query strings may keep their DTOs.
- Tenant id: controllers take `@SchoolId() schoolId: number` (`common/school-id.decorator.ts`, reads `req.schoolId` set by the tenant middleware; no `ParseIntPipe`, it is already a number) and pass it to services as an argument. Every tenant service method takes `schoolId` and uses it explicitly: `where: { school_id }` on reads/update/delete, `data: { school_id }` on create. Postgres RLS is the backup, not the gate. Services never call `requireSchoolId()` and never read `req`.
- DI: constructor injection by type, no `@Inject` for classes. Prisma is the exception (symbol token): `@Inject(PRISMA)` from the global `PrismaModule`.
- Errors: everything goes through `LegacyErrorFilter` (legacy envelope) until all modules are migrated. It maps Prisma P2002 → 409 and P2025 → 404 globally, so services don't try/catch Prisma errors. Update/delete put `school_id` in the `where` (atomic, wrong tenant → P2025 → 404) instead of a find-then-check pre-query. Services throw built-in exceptions only for business rules (e.g. start date after end date → `BadRequestException`).

### Runtime

- Decorator metadata (DI by type, ValidationPipe) needs SWC. Dev runs `node --watch-path=... --import @swc-node/register/esm-register` (`server/package.json` `dev`). No nodemon, never tsx for Nest code.
- `turbo.json` `globalPassThroughEnv` passes `LOCALAPPDATA`/`APPDATA`/`USERPROFILE` so SWC's native binding loads under turbo's strict env mode. Don't remove it.

### Tests (Jest `*.spec.ts`, three layers per module)

| File                     | Tests                                                           | How                                                                                                                                                                                                                                                                            |
| ------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dto/<name>.dto.spec.ts` | Validation rules                                                | Call `new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }).transform(body, { type: 'body', metatype: Dto })` directly. No app, no DB.                                                                                                                           |
| `<name>.service.spec.ts` | Business logic, exact Prisma args                               | Pass a fake Prisma (`{ model: { findMany, create, ... } } as unknown as PrismaClient`, `jest.fn()`s) to the constructor. Assert `toHaveBeenCalledWith`, including `school_id`. Prisma errors: assert they bubble up (`rejects.toMatchObject({ code })`). No DB.                |
| `<name>.http.spec.ts`    | Full stack: routing, guards, validation, envelope, status codes | Boot the real app on port 0, signed JWT + `x-tenant-host` header, real DB. Rejection cases plus one lifecycle test (create → list → update → delete → 404). Push created ids to `createdIds`; `afterAll` deletes them inside `runWithRlsContext({ isSuperAdmin: true }, ...)`. |

Skip controller unit tests: controllers only delegate, and the http spec covers them.

`*.http.spec.ts` set themselves up: `server/jest.http.config.mjs` runs `scripts/test/http-global-setup.mjs`, which takes the Postgres server from `DATABASE_URL`/`DIRECT_URL` (env or `server/.env`), creates and migrates a separate `<db>_test` database (never the dev DB), connects the app as the restricted `school_test_app` role so RLS applies, seeds it idempotently, uses Redis db 15 (`TEST_REDIS_DB`) and starts the fake R2/SMS server (`scripts/test/fake-r2-sms.mjs`) on a free port. Workers get only that env (no dotenv). Only Postgres + Redis need to be running. CI (`.github/workflows/deploy-server.yml`) runs `pnpm test` and `pnpm test:nest` against service containers. DTO/service specs must never hit a real DB or Redis. Logs are silenced under `NODE_ENV=test`; set `TEST_LOGS=1` to see them.

Commands (in `server/`):

- `pnpm test:nest`: all Jest specs (`test:nest:unit` in parallel, then `test:nest:http` one at a time). Filter: `pnpm test:nest --testPathPatterns holiday` (Jest 30, plural) and/or `-t "test name"`.
- `pnpm test`: legacy `node:test` `*.test.ts` for non-migrated modules. Filter with `--test-name-pattern`, not `-t`.

## PDFs — school header

In any generated PDF (certificates, registration/admission forms, marksheets, receipts, etc.), **never** print the school's full address. Show only **upazila and district** (e.g. `Panchbibi, Joypurhat`), built from `school.upazila` and `school.district`. Do not use `school.address`.

In PDF headers, print "Government of the People's Republic of Bangladesh" (Bangla: গণপ্রজাতন্ত্রী বাংলাদেশ সরকার) **only** when `school.ownership === 'Government'`. For Non-Government schools, or when ownership is unset, omit the line.
