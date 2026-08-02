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
