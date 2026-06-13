# BudgetApp

Home budgeting application.

## Tech Stack

| Layer      | Choice                          | Why                                                                        |
| ---------- | ------------------------------- | -------------------------------------------------------------------------- |
| Frontend   | React 18 + TypeScript + Vite    | Fast HMR, first-class TS, React ecosystem                                  |
| Backend    | Node.js + Fastify               | TypeScript-native, schema validation built-in, faster than Express         |
| Database   | PostgreSQL 16                   | Reliable, ACID, row-level security for financial data                      |
| ORM        | Drizzle ORM                     | TypeScript-first, schema-as-code, lightweight, migration tooling included  |
| Monorepo   | npm workspaces                  | Zero extra tooling, native to npm, sufficient for this scale               |
| CI/CD      | GitHub Actions                  | Native, free for open repos, tight GitHub integration                      |

## Repository Structure

```
apps/
  api/        Node.js/Fastify backend
  web/        React/TypeScript frontend
packages/
  db/         Drizzle schema, migrations, db client
docker-compose.yml   Local PostgreSQL
.github/
  workflows/
    ci.yml    Lint + typecheck + test + build
```

## Local Development

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL
docker compose up -d

# 3. Copy env file
cp apps/api/.env.example apps/api/.env

# 4. Run migrations
cd packages/db && npm run db:migrate

# 5. Start dev servers (hot-reload for both)
npm run dev
```

The API runs on http://localhost:3000, the web app on http://localhost:5173.

### Verify

```bash
curl http://localhost:3000/healthz
# {"status":"ok"}
```

## CI/CD

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push/PR to `main`:

1. **Typecheck** — `tsc --noEmit` across all workspaces
2. **Lint** — ESLint across all workspaces
3. **Test** — Vitest unit tests (API uses Fastify's `inject` — no real DB needed; web uses jsdom)
4. **Build** — production build of all workspaces

## Database

Schema lives in `packages/db/src/schema.ts`. Migrations are managed by Drizzle Kit.

```bash
# After changing schema.ts, generate a migration:
cd packages/db && npm run db:generate

# Apply migrations:
cd packages/db && npm run db:migrate
```

## Environment Variables

See `apps/api/.env.example` for the full list. Key variables:

| Variable       | Default                                            | Description           |
| -------------- | -------------------------------------------------- | --------------------- |
| `DATABASE_URL` | `postgres://budgetapp:budgetapp@localhost:5432/budgetapp` | Postgres connection   |
| `PORT`         | `3000`                                             | API port              |
| `CORS_ORIGIN`  | `http://localhost:5173`                            | Allowed CORS origin   |
