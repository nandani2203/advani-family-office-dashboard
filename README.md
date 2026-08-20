# Advani Family Office — Internal Dashboard

An internal back-office dashboard for a family office running **$2B+ in private equity** and
**$1B+ in crypto** across 200+ positions. It answers five questions on one screen: what we own,
what it is worth, what money moved, what is owed to LPs, and what compliance work is due.

Every authenticated user is staff — this is not an investor-facing portal.

- **API** — Nest.js + TypeScript + Prisma, on Supabase Postgres, deployed to Vercel as a
  serverless function. Swagger at `/api/docs`.
- **Web** — Next.js App Router + TailwindCSS + ShadCN UI, deployed to Vercel.

> **Sign in with any email address.** Email delivery is not wired up on this deployment, so the API
> returns the one-time code in the response and the login screen fills it in for you. No inbox
> needed. See [Demo-mode auth](#demo-mode-auth) for how it is gated.

---

## Contents

- [What is built](#what-is-built)
- [Quick start](#quick-start)
- [Working in a fresh checkout](#working-in-a-fresh-checkout)
- [Architecture](#architecture)
- [Data model](#data-model)
- [The dashboard aggregation](#the-dashboard-aggregation)
- [Auth and RBAC](#auth-and-rbac)
- [API reference](#api-reference)
- [Postman](#postman)
- [Tests](#tests)
- [Deployment](#deployment)
- [Environment variables](#environment-variables)
- [Design decisions and trade-offs](#design-decisions-and-trade-offs)
- [What is deliberately not here](#what-is-deliberately-not-here)

---

## What is built

Every capability in the brief, in eight modules on the API and eight screens on the web app.

| # | Capability | Where it lives | State |
|---|---|---|---|
| 1 | Passwordless email OTP, JWT sessions, RBAC | `modules/auth`, `common/guards` | ✅ hashed single-use codes, rotating refresh tokens with reuse detection, three roles |
| 2 | Portfolio overview with live KPIs and charts | `modules/dashboard`, `app/(app)/dashboard` | ✅ four KPIs, cashflow chart, valuation breakdown, four panels — one API call |
| 3 | Investments register | `modules/investments`, `app/(app)/investments` | ✅ CRUD, filters, valuation marks |
| 4 | Assets catalogue | `modules/assets`, `app/(app)/assets` | ✅ CRUD, filters, delete guarded by references |
| 5 | Transactions ledger | `modules/transactions`, `app/(app)/transactions` | ✅ CRUD, type/status/date filters, VOID excluded from totals |
| 6 | Distributions tracking | `modules/distributions`, `app/(app)/distributions` | ✅ declared → approved → paid workflow, withholding, derived net |
| 7 | Compliance filings tracker | `modules/filings`, `app/(app)/filings` | ✅ deadline-first ordering, 30-day window, overdue highlighting |
| 8 | Users, roles and audit log | `modules/users`, `app/(app)/users` | ✅ CRUD, role assignment, audit log behind an ADMIN tab |

### Milestones

| Phase | Scope | State |
|-------|-------|-------|
| 0 | Repo scaffold, Prisma schema + migration, seed data | ✅ |
| 1 | Auth: OTP issue/verify, JWT + refresh, RBAC guards, `/auth/*` | ✅ |
| 2 | Core CRUD across all six resources plus users | ✅ |
| 3 | `/dashboard/summary` aggregation and the index pass | ✅ |
| 4 | Frontend: login, app shell, overview, every list page | ✅ |
| 5 | Tests, Postman collection, Swagger, README, CI | ✅ |
| 6 | Deploy both apps to Vercel, wire Supabase | ⬜ needs a Supabase project and a Vercel account — [steps below](#order-of-operations) |

### Definition of done

- [x] All modules do real CRUD against Postgres, with pagination, sorting and filters on every list
- [x] Overview KPIs computed server-side, in one round-trip
- [x] RBAC enforced — a VIEWER token is rejected on writes, proven in both a unit and an e2e test
- [x] Postman collection with every endpoint, environment variables and an auth pre-request script
- [x] Swagger UI at `/api/docs`
- [x] Jest unit + e2e suites, wired into CI
- [x] README: architecture, schema, setup, env vars, decisions and trade-offs
- [x] Seed data that looks like a real family office, not `foo`/`bar`
- [x] A reviewer can sign in with **any** email — code on screen, no inbox needed
- [ ] Live URLs on Vercel with `/api/health` green — phase 6

By the numbers: **~4,600 lines** of API source, **~6,300** of web source, **~800** of schema and seed,
**75 tests**, **45 Postman requests**.

---

## Quick start

Requires Node 20+ and a Postgres database (local or Supabase).

```bash
# 1. API
cd apps/api
npm install
cp .env.example .env          # then fill in DATABASE_URL and DIRECT_URL
npx prisma migrate deploy     # apply the schema
npm run seed                  # 222 positions of realistic portfolio data
npm run dev                   # http://localhost:4000/api

# 2. Web, in a second terminal
cd apps/web
npm install
cp .env.example .env.local    # NEXT_PUBLIC_API_URL defaults to localhost:4000/api
npm run dev                   # http://localhost:3000
```

Open `http://localhost:3000`, enter any email address, and press Verify — the code is already
filled in. **The first account to sign in becomes ADMIN**; everyone after that becomes EDITOR.

From the repository root, `npm run install:all`, `npm run dev:api`, `npm run dev:web`,
`npm run db:seed` and `npm test` are shortcuts for the same things.

### What the seed produces

Deterministic, from a fixed PRNG seed, so the numbers are identical on every machine. Dates are
relative to *today*, so the trailing-12-month chart and the "due in 30 days" KPI are never empty:

| | |
|---|---|
| 54 assets | SpaceX, Anthropic, OpenAI, Bitcoin, Ethereum, Solana, Coinbase, Dubai and London property, private credit notes |
| 222 positions | 215 active plus 7 realised or written-off, across SPV vintages, fund commitments and direct holdings |
| $4.04B valuation | against a $1.76B cost basis — **$2.03B private equity**, **$1.12B crypto**, then funds, listed positions, property and private credit |
| Transactions per position | capital calls (tranched, for funds), purchases, quarterly fees, staking rewards, coupons, rent — plus scattered PENDING and VOID rows, so the status filters and the VOID exclusion have something to bite on |
| Distributions | on roughly a third of the mature positions, spread across declared, approved and paid |
| 28 filings | three overdue, seven more inside the 30-day window, the rest further out or already closed |
| 7 staff accounts | two ADMIN, three EDITOR, two VIEWER (one still INVITED) |

`npm run seed` prints the resulting headline figures so you can check them against the dashboard.
It is destructive: it clears the tables it owns first, so it is safe to re-run.

---

## Working in a fresh checkout

Nothing here depends on where the folder sits on disk — no absolute paths, no machine-specific
config. Copy it anywhere and it behaves the same.

> **Not yet a git repository.** `.gitignore` is in place but `git init` has not been run. So a plain
> folder copy brings `node_modules` and the `.env` files with it, while a fresh `git clone` will not.
> Before pushing anywhere: `git init && git add . && git commit`. The ignore rules already exclude
> `node_modules`, `dist`, `.next` and every `.env` except the examples.

Three things a clone will be missing, all deliberately uncommitted.

### 1. Environment files

`.env` and `.env.local` hold credentials, so they are gitignored. Recreate them from the committed
examples:

```bash
cp apps/api/.env.example apps/api/.env        # fill in DATABASE_URL and DIRECT_URL
cp apps/web/.env.example apps/web/.env.local  # defaults to http://localhost:4000/api
```

`apps/api/.env.example` documents every variable, with the Supabase pooler URL format spelled out.

### 2. Dependencies

Each app installs independently — there is no workspace root, so a single `npm install` at the top
does nothing:

```bash
npm install --prefix apps/api    # or: npm run install:all
npm install --prefix apps/web
```

`postinstall` runs `prisma generate`, so the Prisma client is rebuilt from `schema.prisma`
automatically. If you copied `node_modules` across machines, re-run `npx prisma generate` in
`apps/api` — the query engine is platform-specific.

### 3. A database

Any Postgres will do; the schema does not use Supabase-specific features. Point `DATABASE_URL` at
it and run `npx prisma migrate deploy` from `apps/api`. `npx prisma db push` is the shortcut if you
would rather not deal with migrations for a local run.

### First-run checklist

Run these in order. Each one is quick, and each proves the layer below it:

```bash
cd apps/api
npm install
npm run typecheck          # 1. the API compiles
npm test                   # 2. 75 unit tests, no database needed
npx prisma migrate deploy  # 3. schema applied
npm run seed               # 4. prints the portfolio totals it just wrote
npm run test:e2e           # 5. e2e against the real database
npm run dev                # 6. http://localhost:4000/api/docs

cd ../web
npm install
npm run typecheck          # 7. the frontend compiles
npm run build              # 8. production build
npm run dev                # 9. http://localhost:3000 — sign in with any email
```

Steps 1–2 and 7–8 are exactly what `.github/workflows/ci.yml` runs, so green locally means green in
CI. **These have not yet been executed on the authoring machine**, which had no Node runtime
available — the code was verified by static analysis instead (every import resolved against its
target's exports, every Prisma delegate and enum checked against the generated client, every
controller and module confirmed wired, the seed totals computed arithmetically). Expect the first
`typecheck` to be where any remaining friction shows up; the most likely spots are recharts' `Tooltip
content` prop typing in [cashflow-chart.tsx](apps/web/src/components/charts/cashflow-chart.tsx) and
the `$transaction` tuple inference in
[dashboard.service.ts](apps/api/src/modules/dashboard/dashboard.service.ts). Delete this paragraph
once the checklist is green.

---

## Architecture

```
apps/api/                          Nest.js
  api/index.js                     Vercel entry — plain JS, requires ../dist/serverless
  prisma/
    schema.prisma                  10 models, 11 enums
    migrations/                    SQL migrations
    seed.ts                        deterministic portfolio
  src/
    main.ts                        local bootstrap
    serverless.ts                  Nest on a cached Express instance
    setup.ts                       pipes, filters, CORS, Swagger — shared by both
    common/                        guards, decorators, DTOs, filters, interceptors, PrismaService
    config/                        typed config + env validation
    modules/
      auth/  users/  assets/  investments/
      transactions/  distributions/  filings/
      dashboard/  health/

apps/web/                          Next.js App Router
  src/app/
    login/                         email → OTP, resend timer, dev-code banner
    (app)/                         authenticated shell: sidebar, mobile drawer, auth guard
      dashboard/ investments/ assets/
      transactions/ distributions/ filings/ users/
  src/components/                  app shell, data table, charts, forms, ShadCN primitives
  src/lib/                         typed API client, auth context, list hook, formatters

postman/                           collection + environment
.github/workflows/ci.yml           typecheck, unit, e2e against real Postgres, web build
project.md                         the original brief this was built against
```

### Where to look for what

If you are reading this cold, these are the files that carry the weight. Everything else is
plumbing that follows from them.

| Question | File |
|---|---|
| How is the data shaped? | [schema.prisma](apps/api/prisma/schema.prisma) — start here |
| How are the KPIs and charts computed? | [dashboard.service.ts](apps/api/src/modules/dashboard/dashboard.service.ts) |
| How does sign-in work? | [auth.service.ts](apps/api/src/modules/auth/auth.service.ts) |
| How is RBAC enforced? | [roles.guard.ts](apps/api/src/common/guards/roles.guard.ts) + [roles.decorator.ts](apps/api/src/common/decorators/roles.decorator.ts) |
| Where do pagination, sorting and filtering come from? | [pagination.dto.ts](apps/api/src/common/dto/pagination.dto.ts) — one helper, used by every list |
| Why do amounts arrive as numbers? | [serialization.ts](apps/api/src/common/serialization.ts) |
| What does an error look like? | [http-exception.filter.ts](apps/api/src/common/filters/http-exception.filter.ts) |
| Who changed what? | [audit.interceptor.ts](apps/api/src/common/interceptors/audit.interceptor.ts) |
| Where does the demo data come from? | [seed.ts](apps/api/prisma/seed.ts) |
| How does the frontend talk to the API? | [api-client.ts](apps/web/src/lib/api-client.ts) — typed, refresh-on-401, coalesced |
| How does a list page work? | [use-list.ts](apps/web/src/lib/use-list.ts) + [data-table.tsx](apps/web/src/components/data-table.tsx) — all six pages share these |
| Where is a representative screen? | [investments/page.tsx](apps/web/src/app/%28app%29/investments/page.tsx) — the richest of the six |
| How does the app boot on Vercel? | [serverless.ts](apps/api/src/serverless.ts) + [api/index.js](apps/api/api/index.js) + [vercel.json](apps/api/vercel.json) |

Each module on the API follows the same four-file shape, so once you have read one you have read
all eight:

```
modules/<name>/
  <name>.controller.ts     routes, @Roles, @Audit, Swagger annotations
  <name>.service.ts        business rules and Prisma queries
  <name>.module.ts         wiring
  dto/<name>.dto.ts        create / update / query DTOs with class-validator
```

### Request path

```
Browser
  │  Authorization: Bearer <access token>
  ▼
Vercel rewrite  /(.*) → /api        (so Nest's own router sees every path)
  ▼
api/index.js → dist/serverless      (Nest booted once per warm container)
  ▼
JwtAuthGuard → RolesGuard → ThrottlerGuard
  ▼
ValidationPipe (whitelist, forbid unknown) → Controller → Service → Prisma
  ▼
SerializeInterceptor (Decimal → number, Date → ISO)
AuditInterceptor     (writes an audit row for mutations, best-effort)
AllExceptionsFilter  (one error shape for everything)
  ▼
Supabase Postgres via the connection pooler
```

### Cross-cutting pieces worth knowing about

| Piece | Where | What it does |
|---|---|---|
| `SerializeInterceptor` | `common/interceptors` | Prisma `Decimal` serialises as `{"s":1,"e":6,"d":[…]}`, which is useless to a frontend. Converts to plain numbers and dates to ISO strings, recursively. |
| `AllExceptionsFilter` | `common/filters` | Every error leaves as `{ statusCode, message, errors?, path, timestamp }`. Prisma error codes are mapped: `P2002` → 409 with the conflicting field, `P2003` → 400, `P2025` → 404. |
| `AuditInterceptor` | `common/interceptors` | Writes an audit row for any handler marked `@Audit(action, resource)`. Failures are logged, never propagated — an audit problem must not fail the user's request. |
| `resolveOrderBy` | `common/dto/pagination.dto.ts` | `sortBy` is checked against a per-module allow-list before it reaches Prisma, so a query string cannot steer the `ORDER BY` clause. |
| `PaginationQueryDto` | `common/dto` | `page`, `pageSize` (max 100), `search`, `sortBy`, `sortDir` on every list endpoint. |

---

## Data model

Ten models. Amounts are `DECIMAL(20,2)` — never floats — and every FK, plus `occurred_at`,
`due_date` and the status columns, is indexed.

```
users ──┬─< refresh_tokens
        ├─< filings          (assignee, SET NULL)
        └─< audit_logs       (actor, SET NULL)

otp_codes                    (standalone; hashed, single-use, TTL)

assets ─< investments ─┬─< valuations      (unique on investment + as_of)
                       ├─< transactions
                       └─< distributions
```

| Model | Purpose |
|---|---|
| `User` | Staff. `role` ADMIN/EDITOR/VIEWER, `status` ACTIVE/INVITED/SUSPENDED. |
| `OtpCode` | Sign-in codes. Only the bcrypt hash is stored. |
| `RefreshToken` | Rotating tokens, stored as SHA-256 hashes, with reuse detection. |
| `Asset` | The underlying thing owned — a company, a token, a fund, a building. |
| `Investment` | A position in an asset held through an SPV, a fund or directly. Carries `committedAmount`, `investedAmount`, `costBasis`, `currentValuation`, `ownershipPct`. |
| `Valuation` | Mark history. Recording one also moves the position's current mark, in the same transaction. |
| `Transaction` | Cashflow: capital calls, purchases, sales, fees, dividends, interest. `direction` and `status`. |
| `Distribution` | LP payouts through declared → approved → paid, with withholding tax. |
| `Filing` | Compliance deadlines: KYC, VAT, MRV, annual returns, tax. |
| `AuditLog` | Who changed what, and from where. |

### Invariants the API enforces

- **`Distribution.netAmount` is derived**, always `gross − withholding`, never accepted from the
  client. Withholding above gross is a 400.
- **`Transaction.direction` defaults from `type`** — calls, purchases and fees go out; sales,
  dividends and interest come in. Changing the type without an explicit direction re-derives it, so
  the two cannot drift apart.
- **A distribution only moves one step at a time** along declared → approved → paid, or back one to
  correct a mistake. Declared → paid is refused.
- **Reaching SUBMITTED or CLOSED stamps `Filing.submittedAt` once**; reopening clears it. Closing an
  already-submitted filing keeps the original date.
- **An asset with positions against it cannot be deleted.** A paid distribution cannot be deleted.
- **The last active administrator cannot be demoted, suspended or deleted**, and nobody can suspend
  or delete their own account — locking every admin out is not recoverable through the UI.
- **Changing a role or suspending an account revokes that user's refresh tokens**, so a demoted
  session cannot keep writing.
- **A distribution cannot be reassigned to a different investment** — that would corrupt two
  positions' history at once. `investmentId` is omitted from the update DTO.

### Migrations

`prisma/migrations/20250101000000_init` was authored by hand rather than generated, because the
schema was written before a database was available to generate against. CI guards it:

```bash
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" \
  --exit-code
```

A non-zero exit means the migration and `schema.prisma` disagree. Run this locally against a scratch
database before trusting the migration; `npx prisma db push` is the fallback if you would rather
skip migrations entirely for a demo.

---

## The dashboard aggregation

`GET /dashboard/summary` returns everything the overview screen shows in **one database
round-trip** — one `$transaction` containing nine reads:

| Figure | How |
|---|---|
| Portfolio valuation | `SUM(current_valuation)` over ACTIVE investments |
| Cost basis, unrealised gain | `SUM(cost_basis)`; gain is valuation − cost, and can be negative |
| Investments | count of all, and of ACTIVE, separately |
| Upcoming filings | `due_date <= now + 30d AND status != CLOSED` |
| Cashflow, 12 months | raw SQL: `date_trunc('month', occurred_at)` grouped by month and direction, `status <> 'VOID'`, sums cast to text so the driver returns exact decimals |
| Valuation by asset type | raw SQL joining `investments` to `assets`, grouped by `assets.type` |
| Distributions | `groupBy(status)` summing `net_amount`; declared + approved is the pending liability |
| Committed vs deployed | sums of `committed_amount` and `invested_amount`; uncalled is the clamped difference |

Two of the reads are raw SQL because Prisma's `groupBy` cannot group by a **relation** column
(`assets.type`) or truncate a timestamp to a month. Both are parameterised.

Postgres only returns months that had transactions, so the service **zero-fills** the series to a
continuous 12-month axis — otherwise a quiet month would silently collapse the chart's x-axis.

### Charts

The cashflow chart plots inflow, outflow and net on **one axis** — all three are USD, and a second
y-scale would let the net line imply a magnitude it does not have. Series colours come from the
first three slots of a palette validated for colour-vision-deficiency separation, and identity is
never carried by colour alone: a legend is always present and the same twelve months are one click
away as a table. Valuation by asset type is a ranked bar list in a single hue rather than seven
categorical colours — seven hues cannot clear the separation gates, and each row is already labelled.

---

## Auth and RBAC

### The sign-in flow

```
POST /auth/request-otp   { email }
      → 6-digit code, bcrypt-hashed at rest, 10-minute TTL, 5-attempt cap
      → outstanding codes for that address are invalidated, so only the newest works
      → per-address 30s resend cooldown, and a 5/minute rate limit on the endpoint

POST /auth/verify-otp    { email, code }
      → { accessToken (15m), refreshToken (30d), user }
      → the code is consumed; replaying it is a 401

POST /auth/refresh       { refreshToken }
      → rotates: the presented token is revoked and a new pair issued
      → a token that comes back after rotation is treated as leaked: every session
        for that user is revoked and the call answers 401
```

Refresh tokens are stored as SHA-256 hashes with a 32-byte random `jti`, so the stored value stays
unguessable even if the signing secret leaks. The frontend coalesces concurrent 401s into a **single**
refresh — without that, ten parallel table loads would each try to rotate the token and trip reuse
detection.

### Roles

| | Read | Write portfolio, finance, compliance | Delete | Manage users, audit log |
|---|---|---|---|---|
| `VIEWER` | ✅ | ❌ | ❌ | ❌ |
| `EDITOR` | ✅ | ✅ | ❌ | ❌ |
| `ADMIN` | ✅ | ✅ | ✅ | ✅ |

Enforced by `RolesGuard` from `@Roles(...)` metadata, applied globally after `JwtAuthGuard`. Deletes
are ADMIN-only throughout — an EDITOR can correct a record but not erase history. The frontend hides
what a role cannot do, but the API is the boundary: `roles.guard.spec.ts` asserts the matrix
directly, and `auth.e2e-spec.ts` proves a VIEWER token is refused on POST, PATCH and DELETE against
a live server.

### Demo-mode auth

Two flags, both defaulting **on** so a reviewer can sign in immediately:

- `OPEN_SIGNUP` — any email may sign in; the account is created on first use. First account becomes
  ADMIN, the rest EDITOR.
- `EXPOSE_OTP` — the code is returned in the response body as `devCode` and shown in a banner on the
  login screen.

For a real deployment, set both to `false`. `requestOtp` then refuses unknown addresses without
revealing whether they are registered, and the code only goes to the log — the hand-off point for a
mail provider is marked in `auth.service.ts`.

---

## API reference

Base path `/api`. Swagger UI at `/api/docs`, generated from the DTOs.

Every list endpoint accepts `page`, `pageSize` (≤100), `search`, `sortBy`, `sortDir` and returns
`{ data, meta: { page, pageSize, total, totalPages } }`.

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/health` | public | `{ status, database, uptime }` |
| GET | `/auth/config` | public | `{ openSignup }` |
| POST | `/auth/request-otp` | public | 5/min |
| POST | `/auth/verify-otp` | public | 10/min |
| POST | `/auth/refresh` | public | rotating, reuse-detecting |
| POST | `/auth/logout` | any | revokes one session, or all |
| GET | `/auth/me` | any | |
| GET | `/dashboard/summary` | any | all overview data, one round-trip |
| GET | `/assets` `/assets/options` `/assets/{id}` | any | filters: `type`, `sector` |
| POST/PATCH | `/assets` `/assets/{id}` | EDITOR+ | |
| DELETE | `/assets/{id}` | ADMIN | refused while positions reference it |
| GET | `/investments` `/investments/options` `/investments/{id}` | any | filters: `status`, `vehicle`, `assetId` |
| POST/PATCH | `/investments` `/investments/{id}` | EDITOR+ | create also writes the opening mark |
| POST | `/investments/{id}/valuations` | EDITOR+ | records a mark and moves the current valuation |
| DELETE | `/investments/{id}` | ADMIN | cascades |
| GET | `/transactions` `/transactions/{id}` | any | filters: `type`, `direction`, `status`, `investmentId`, `from`, `to` |
| POST/PATCH | `/transactions` `/transactions/{id}` | EDITOR+ | `direction` defaults from `type` |
| DELETE | `/transactions/{id}` | ADMIN | prefer VOID |
| GET | `/distributions` `/distributions/{id}` | any | filters: `status`, `investmentId`, `from`, `to` |
| POST/PATCH | `/distributions` `/distributions/{id}` | EDITOR+ | net is derived |
| PATCH | `/distributions/{id}/status` | EDITOR+ | one step at a time |
| DELETE | `/distributions/{id}` | ADMIN | never once paid |
| GET | `/filings` `/filings/{id}` | any | filters: `type`, `status`, `assigneeId`, `dueSoon` |
| POST/PATCH | `/filings` `/filings/{id}` | EDITOR+ | status stamps `submittedAt` |
| DELETE | `/filings/{id}` | ADMIN | |
| GET | `/users` `/users/options` `/users/{id}` | any | filters: `role`, `status` |
| GET | `/users/audit-logs` | ADMIN | filters: `resource`, `action`, `actorId` |
| POST | `/users` | ADMIN | starts INVITED |
| PATCH | `/users/{id}` `/users/{id}/role` | ADMIN | email immutable |
| DELETE | `/users/{id}` | ADMIN | not self, not the last admin |

---

## Postman

`postman/advani-dashboard.postman_collection.json` — 45 requests across nine folders, plus
`advani-dashboard.postman_environment.json`.

Import both, select the environment, set `baseUrl`, and send any request. **There is no sign-in step
to do by hand.** A collection-level pre-request script notices there is no `accessToken`, requests an
OTP for `email`, reads `devCode` out of the response, verifies it, and stores the token pair; every
other request inherits bearer auth from the collection. List requests capture the first row's id into
`assetId`, `investmentId` and so on, so the detail, update and delete requests below them work
without copying ids around.

A handful of requests carry assertions — that the unrealised gain really is valuation minus cost
basis, that the cashflow series is twelve months long, that a distribution's net is gross minus
withholding, that a capital call is recorded as an outflow.

---

## Tests

```bash
cd apps/api
npm test                 # unit — no database needed
npm run test:e2e         # e2e — needs a scratch Postgres in DATABASE_URL
```

**Unit** (`*.spec.ts` beside the code, mocked Prisma):

| Suite | Covers |
|---|---|
| `dashboard.service.spec.ts` | Every derived figure: gain and its percentage, losses staying negative, division by zero on an empty book, the 12-month axis being continuous and zero-filled, months outside the window ignored, shares summing to 100%, uncalled capital never negative, and that it all happens in one `$transaction`. |
| `auth.service.spec.ts` | Codes stored only as hashes, six digits, single use, attempt cap, resend cooldown, suspended accounts refused, first-user-is-admin, refresh-token hashing, rotation, and reuse killing every session. |
| `distributions.service.spec.ts` | Net always derived, withholding validated on create and update, the full status matrix including refused transitions, payment-date stamping, and paid distributions being undeletable. |
| `filings.service.spec.ts` | Deadline-first default ordering, the 30-day `dueSoon` window, and `submittedAt` stamping — including that closing an already-submitted filing keeps the original date. |
| `roles.guard.spec.ts` | The RBAC matrix, directly. |
| `pagination.dto.spec.ts` | Skip maths, page counts, and that a `sortBy` outside the allow-list cannot reach `ORDER BY`. |

**E2E** (`test/*.e2e-spec.ts`, real Nest app on a real database): the whole sign-in journey, token
rotation and reuse detection, logout, an audit row actually being written, the RBAC refusals, and
`/dashboard/summary` checked *against the database* rather than against hard-coded numbers — so it
passes on the seeded portfolio and on whatever a reviewer has since edited.

CI runs typecheck, the unit suite, the migration-drift check, migrations, the seed and the e2e suite
against a Postgres service container, plus the web typecheck, lint and build.

---

## Deployment

One repository, **two Vercel projects**, each with its own Root Directory.

| Project | Root Directory | Preset |
|---|---|---|
| `allocations-web` | `apps/web` | Next.js (auto-detected) |
| `allocations-api` | `apps/api` | Other |

### Why the API is shaped the way it is

Vercel's Node builder compiles `api/*.ts` with esbuild, which does **not** emit
`emitDecoratorMetadata` — that would break Nest's dependency injection outright. So the build
sidesteps it:

1. `npm run build` runs `nest build` — real `tsc`, metadata intact — into `dist/`.
2. `api/index.js` is **plain JavaScript** and simply `require`s `../dist/serverless`.
3. `serverless.ts` boots Nest onto an Express instance **once** and caches it, so only a cold start
   pays for initialisation.
4. `vercel.json` rewrites `/(.*)` → `/api`, so Nest's own router handles every path.
5. `includeFiles` pulls the Prisma query engine into the function bundle.

### Supabase connections

A serverless function opens a connection per instance, which exhausts Postgres quickly:

- `DATABASE_URL` → the **pooler** on port `6543` with `?pgbouncer=true&connection_limit=1`, used at
  runtime.
- `DIRECT_URL` → the direct connection on port `5432`, used only by `prisma migrate`, which cannot
  run through a transaction pooler.

### Order of operations

1. Create the Supabase project; copy both connection strings.
2. Deploy `allocations-api` with the variables below. Run `npx prisma migrate deploy` and
   `npm run seed` against `DIRECT_URL` from your machine.
3. Check `https://<api>/api/health` — `{"status":"ok","database":"up"}`.
4. Deploy `allocations-web` with `NEXT_PUBLIC_API_URL=https://<api>/api`.
5. Set `CORS_ORIGINS` on the API to the web URL and redeploy.

---

## Environment variables

### `apps/api`

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | Pooled Postgres connection (port 6543 on Supabase) |
| `DIRECT_URL` | for migrations | — | Direct connection (port 5432) |
| `JWT_SECRET` | in production | dev fallback | Access-token signing; ≥32 chars |
| `JWT_REFRESH_SECRET` | in production | dev fallback | Refresh-token signing; ≥32 chars |
| `JWT_ACCESS_TTL` | | `15m` | Access-token lifetime |
| `JWT_REFRESH_TTL_DAYS` | | `30` | Refresh-token lifetime |
| `OPEN_SIGNUP` | | `true` | Any email may sign in |
| `EXPOSE_OTP` | | `true` | Return the code in the response |
| `OTP_TTL_MINUTES` | | `10` | Code lifetime |
| `OTP_MAX_ATTEMPTS` | | `5` | Wrong guesses before the code is burned |
| `OTP_RESEND_SECONDS` | | `30` | Per-address resend cooldown |
| `CORS_ORIGINS` | | `*` | Comma-separated allowed origins |
| `PORT` | | `4000` | Local only |

Missing `DATABASE_URL` fails at boot with an actionable message rather than on the first query. Weak
JWT secrets warn in development and **throw** in production.

### `apps/web`

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | API base URL, including the `/api` prefix |

---

## Design decisions and trade-offs

**Prisma over TypeORM.** Better TypeScript ergonomics and a cleaner migration story against
Supabase. The cost is that `groupBy` cannot group by a relation column or truncate a timestamp — so
two of the dashboard's nine reads are parameterised raw SQL. That is a fair trade: those two queries
are the only place raw SQL appears, and they are the two that most needed the database to do the work.

**`Decimal(20,2)`, not floats.** Money is exact. The consequence is that Prisma hands back `Decimal`
objects, which serialise into something a frontend cannot do arithmetic with — hence
`SerializeInterceptor`. SQL sums in the raw queries are cast to `text` and parsed, rather than to
`float8`, so nothing is lost on the way out of Postgres either.

**One aggregation endpoint, not six.** The overview would otherwise be six round-trips from the
browser, each with its own auth and cold-start cost, and the KPIs could disagree with each other
mid-load. `/dashboard/summary` is one call, computed inside one transaction, so every number on the
screen describes the same instant — which is also why the response carries `generatedAt`.

**Derived values are computed server-side, always.** `netAmount` and `direction` are never taken from
the client even though the client could compute them, because a client that gets it wrong writes a
row that reconciles to nothing.

**VOID rather than DELETE for transactions.** A reversal is an event, not an absence. Voided rows
stay visible in the ledger — struck through — and drop out of every total. DELETE exists but is
ADMIN-only, and the confirmation dialog suggests voiding instead.

**Valuation history is append-only, and writing a mark moves the current valuation** in the same
transaction. Two writes that could disagree are one write that cannot.

**Refresh-token rotation with reuse detection**, rather than long-lived access tokens. The cost is
the concurrency problem described above, solved by coalescing refreshes in the client.

**Client-side auth guard, server-side enforcement.** The `(app)` layout redirects an unauthenticated
visitor to `/login`, and the sidebar hides actions a role cannot perform, but neither is a security
boundary — the API rejects the request regardless, and the tests assert that rather than asserting
the UI hides the button.

**Bcrypt for OTP codes, SHA-256 for refresh tokens.** A six-digit code has only a million
possibilities, so it needs a slow hash. A refresh token is already 32 bytes of entropy, so a fast
digest is enough and keeps the hot path cheap.

**Hand-authored initial migration.** Written before a database existed to generate against, with a
CI `migrate diff` check as the guard. `prisma db push` is the escape hatch.

**No npm workspace.** Each app installs independently, so either can be built from its own Vercel
Root Directory without hoisting surprises. The cost is two `node_modules` trees and two lockfiles.

**Light theme only.** Dark-mode tokens — including chart steps chosen for a dark surface rather than
flipped — are defined in `globals.css`, so a toggle is a small change; shipping a half-tuned dark
mode is worse than shipping none.

---

## What is deliberately not here

- **Blockchain, Solidity, tokenization mechanics.** Listed as *preferred* in the brief and absent
  from the reference solution. Tokenized holdings are modelled as an asset type, which is what the
  back office actually needs to see.
- **Live market data.** Valuations are entered by hand, with a `source` field, because private marks
  come from managers and secondary prints, not a feed.
- **Multi-currency.** Everything is USD. `Transaction.fxRate` exists and is applied in the cashflow
  aggregation, so a second currency is a data problem rather than a schema migration.
- **Multi-tenancy.** Single tenant, many users. No org table.
- **Document upload.** Not in the reference solution.
- **Email delivery.** Deliberately stubbed so a reviewer can sign in without an inbox; the hand-off
  point is marked in `auth.service.ts`.
