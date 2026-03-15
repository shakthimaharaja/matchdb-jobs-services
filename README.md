# matchdb-jobs-services

Jobs, Candidate Profiles, Applications, Matching, Pokes & Marketer backend for the MatchDB staffing platform. Uses the **same PostgreSQL database** as shell-services (generate-only — no migrations).

---

## Tech Stack

| Layer      | Technology                                         |
| ---------- | -------------------------------------------------- |
| Runtime    | Node.js + TypeScript                               |
| Framework  | Express 4                                          |
| Database   | PostgreSQL via Prisma 5 (generate-only, shared DB) |
| Auth       | JWT verification (tokens issued by shell-services) |
| Email      | SendGrid                                           |
| Matching   | Skill-based scoring engine + skill extraction      |
| Validation | Zod                                                |
| Security   | Helmet, CORS, compression                          |
| Realtime   | WebSocket (ws) — live counts & public data feeds   |

---

## Project Structure

```
matchdb-jobs-services/
├── prisma/
│   └── schema.prisma          # Generate-only schema (8 job models — no migrations)
├── src/
│   ├── index.ts               # Entry point — HTTP server + WebSocket upgrade routing
│   ├── app.ts                 # Express app (routes, middleware, Swagger)
│   ├── config/
│   │   ├── env.ts             # Environment variable loading & validation
│   │   ├── prisma.ts          # Prisma client singleton
│   │   └── swagger.ts         # OpenAPI 3.0 spec (all endpoints)
│   ├── controllers/
│   │   ├── jobs.controller.ts      # CRUD for jobs, profiles, applications, matching, pokes
│   │   ├── marketer.controller.ts  # Company, roster, forwarding, invites
│   │   ├── financials.controller.ts # Project financials, state tax rates, summaries
│   │   └── ingest.controller.ts    # Bulk job/profile ingestion (internal)
│   ├── middleware/
│   │   ├── auth.middleware.ts      # JWT verification guard (reads username from token)
│   │   └── error.middleware.ts     # Global error handler + 404
│   ├── routes/
│   │   ├── jobs.routes.ts         # /api/jobs/*
│   │   └── marketer.routes.ts     # /api/marketer/*
│   └── services/
│       ├── matching.service.ts       # Candidate-job matching algorithm
│       ├── skill-extractor.service.ts # Auto-extract skills from text (~150 keywords)
│       ├── sendgrid.service.ts       # Email dispatch
│       ├── sse.service.ts            # Server-Sent Events for live refresh
│       ├── ws-counts.service.ts      # WebSocket /ws/counts — live job & profile counts
│       └── ws-public-data.service.ts # WebSocket /ws/public-data — live data with diffs
├── Dockerfile
├── env/
│   └── .env.local             # Local env vars
├── package.json
└── tsconfig.json
```

---

## API Endpoints

### Jobs

| Method | Path                                  | Auth      | Description                         |
| ------ | ------------------------------------- | --------- | ----------------------------------- |
| GET    | `/api/jobs/`                          | No        | List all active jobs                |
| GET    | `/api/jobs/count`                     | No        | Get total job count                 |
| GET    | `/api/jobs/profiles-count`            | No        | Get total profile count             |
| GET    | `/api/jobs/profiles-public`           | No        | List publicly visible profiles      |
| POST   | `/api/jobs/create`                    | Vendor    | Create a new job                    |
| GET    | `/api/jobs/vendor`                    | Vendor    | Get vendor's own jobs               |
| GET    | `/api/jobs/profilematches`            | Vendor    | Ranked candidate matches for vendor |
| GET    | `/api/jobs/profile`                   | Yes       | Get own candidate profile           |
| POST   | `/api/jobs/profile`                   | Candidate | Create own profile                  |
| PUT    | `/api/jobs/profile`                   | Candidate | Update own profile                  |
| DELETE | `/api/jobs/profile`                   | Candidate | Delete own profile                  |
| GET    | `/api/jobs/my-applications`           | Candidate | Get own applications                |
| GET    | `/api/jobs/jobmatches`                | Candidate | Ranked job matches for candidate    |
| POST   | `/api/jobs/poke`                      | Yes       | Send a poke notification            |
| GET    | `/api/jobs/pokes/sent`                | Yes       | Get pokes sent by current user      |
| GET    | `/api/jobs/pokes/received`            | Yes       | Get pokes received by current user  |
| GET    | `/api/jobs/resume/:username`          | No        | Public profile by username          |
| GET    | `/api/jobs/resume/:username/download` | Yes       | Download candidate resume           |
| GET    | `/api/jobs/:id`                       | No        | Get job details                     |
| POST   | `/api/jobs/:id/apply`                 | Candidate | Apply to a job                      |
| PATCH  | `/api/jobs/:id/close`                 | Vendor    | Close/deactivate a job              |
| PATCH  | `/api/jobs/:id/reopen`                | Vendor    | Reopen a closed job                 |
| GET    | `/health`                             | No        | Health check                        |

### Marketer

| Method | Path                                       | Auth     | Description                               |
| ------ | ------------------------------------------ | -------- | ----------------------------------------- |
| GET    | `/api/marketer/stats`                      | Marketer | Dashboard stats                           |
| GET    | `/api/marketer/jobs`                       | Marketer | Browse available jobs                     |
| GET    | `/api/marketer/profiles`                   | Marketer | Browse candidate profiles                 |
| POST   | `/api/marketer/company`                    | Marketer | Register a company                        |
| GET    | `/api/marketer/company`                    | Marketer | Get own company                           |
| GET    | `/api/marketer/company-summary`            | Marketer | Company financial/resource summary        |
| POST   | `/api/marketer/candidates`                 | Marketer | Add candidate to roster                   |
| GET    | `/api/marketer/candidates`                 | Marketer | List rostered candidates                  |
| GET    | `/api/marketer/candidates/:id/detail`      | Marketer | Full candidate detail (profile, projects) |
| DELETE | `/api/marketer/candidates/:id`             | Marketer | Remove candidate from roster              |
| POST   | `/api/marketer/candidates/:id/invite`      | Marketer | Send invite link to candidate             |
| POST   | `/api/marketer/forward`                    | Marketer | Forward a job to a candidate              |
| POST   | `/api/marketer/forward-with-email`         | Marketer | Forward opening + send email notification |
| GET    | `/api/marketer/forwarded`                  | Marketer | List forwarded openings                   |
| PATCH  | `/api/marketer/forwarded/:id/status`       | Marketer | Update forwarded opening status           |

### Financials

| Method | Path                                              | Auth     | Description                          |
| ------ | ------------------------------------------------- | -------- | ------------------------------------ |
| GET    | `/api/marketer/financials/states`                 | Marketer | US state tax rates                   |
| GET    | `/api/marketer/financials/summary`                | Marketer | Company-wide financial summary       |
| GET    | `/api/marketer/financials/candidate/:candidateId` | Marketer | Candidate financial records          |
| GET    | `/api/marketer/financials/:applicationId`         | Marketer | Get project financial record         |
| POST   | `/api/marketer/financials`                        | Marketer | Create/update project financial data |
| DELETE | `/api/marketer/financials/:applicationId`         | Marketer | Delete project financial record      |

### Candidate

| Method | Path                              | Auth      | Description                    |
| ------ | --------------------------------- | --------- | ------------------------------ |
| GET    | `/api/jobs/candidate/forwarded`   | Candidate | Forwarded openings for self    |
| GET    | `/api/jobs/candidate/my-detail`   | Candidate | Full self-detail + financials  |

### Company & Invites (Public / Auth)

| Method | Path                              | Auth    | Description                    |
| ------ | --------------------------------- | ------- | ------------------------------ |
| GET    | `/api/jobs/companies`             | No      | List all companies             |
| GET    | `/api/jobs/companies/search`      | No      | Fuzzy company search           |
| GET    | `/api/jobs/invite/:token`         | No      | Verify invite token            |
| POST   | `/api/jobs/invite/:token/accept`  | Yes     | Accept invite                  |

### Internal

| Method | Path                          | Auth         | Description              |
| ------ | ----------------------------- | ------------ | ------------------------ |
| POST   | `/api/internal/ingest/jobs`     | Internal key | Bulk ingest jobs         |
| POST   | `/api/internal/ingest/profiles` | Internal key | Bulk ingest profiles     |

### WebSocket Endpoints

| Path              | Description                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `/ws/counts`      | Broadcasts `{ jobs, profiles }` counts every 30 s with jitter simulation                 |
| `/ws/public-data` | Broadcasts full job + profile snapshots every 30 s with diff tracking (changed, deleted) |

---

## Data Models (Prisma)

### Job

`title`, `description`, `vendorId`, `vendorEmail`, `recruiterName`, `recruiterPhone`, `location`, `jobCountry`, `jobState`, `jobCity`, `jobType` (full_time / contract), `jobSubType` (c2c / c2h / w2 / 1099 / direct_hire / salary), `salaryMin`, `salaryMax`, `payPerHour`, `skillsRequired[]`, `experienceRequired`, `workMode` (onsite / remote / hybrid), `isActive`

### CandidateProfile

`candidateId`, `username`, `name`, `email`, `phone`, `currentCompany`, `currentRole`, `preferredJobType`, `expectedHourlyRate`, `experienceYears`, `skills[]`, `location`, `profileCountry`, `bio`, `resumeSummary`, `resumeExperience`, `resumeEducation`, `resumeAchievements`, `visibilityConfig` (domain→subdomain map), `profileLocked`

### Application

`jobId`, `jobTitle`, `candidateId`, `candidateEmail`, `coverLetter`, `status` (pending / reviewed / accepted / rejected)

### PokeLog

Rate-limits poke interactions per user per month:
`userId`, `yearMonth` (YYYY-MM format), `count` — unique compound index on `(userId, yearMonth)`

### PokeRecord

Individual poke interactions: `fromUserId`, `toUserId`, `fromUserType`, `toUserType`, `jobId?`, `message?`

### Company

Marketer company: `name`, `marketerId`, `marketerEmail`

### MarketerCandidate

Roster entry: `companyId`, `marketerId`, `candidateId`, `candidateName`, `candidateEmail`

### ForwardedOpening

`marketerId`, `candidateId`, `candidateName`, `candidateEmail`, `jobId`, `jobTitle`, `vendorEmail`

### CompanyInvite

Marketer invite tokens: `companyId`, `marketerId`, `candidateEmail`, `token` (unique), `status` (pending / accepted / expired), `expiresAt`

### ProjectFinancial

Per-application financial record: `applicationId`, `companyId`, `candidateId`, `billRate`, `payRate`, `hoursPerWeek`, `stateTaxRate`, `federalTaxRate`, `cashPct`, `netPayable`, `margin`

---

## Skill Extraction

`skill-extractor.service.ts` auto-extracts skills from free-form text (resumes, job descriptions) using a curated list of ~150 keywords across: Languages, Frontend, Backend, Databases, Cloud/DevOps, Data/AI/ML, Tools, Mobile, Testing. Case-insensitive with word-boundary matching.

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **PostgreSQL** running (same instance as shell-services)
- **shell-services** must have run migrations first (`npx prisma migrate dev`)

### Environment Variables

Create `env/.env.local`:

```env
PORT=8001
NODE_ENV=local
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/matchdb
JWT_SECRET=dev-jwt-secret-change-in-production-min-32-chars
SENDGRID_API_KEY=
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:4000,http://localhost:4001
CLIENT_URL=http://localhost:3000
```

> **Note:** `JWT_SECRET` must match the one used in `matchdb-shell-services` since tokens are issued there and verified here.

### Install & Run

```powershell
# 1. Install dependencies
npm install

# 2. Generate Prisma client (generate-only — never run migrate here)
npx prisma generate

# 3. Start the dev server (hot-reload)
npm run dev
```

The server starts on **http://localhost:8001**.

---

## Scripts

| Script          | Description                       |
| --------------- | --------------------------------- |
| `npm run dev`   | Start with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/`     |
| `npm start`     | Run compiled output               |

---

## API Documentation (Swagger)

Interactive API docs at **http://localhost:8001/api-docs**. OpenAPI 3.0 spec defined in `src/config/swagger.ts`.

---

## License

MIT
