# matchdb-jobs-services

Jobs, Candidate Profiles, Applications, Matching, Pokes & Marketer backend for the MatchDB staffing platform. Uses **MongoDB Atlas** via Mongoose.

---

## Tech Stack

| Layer      | Technology                                         |
| ---------- | -------------------------------------------------- |
| Runtime    | Node.js + TypeScript                               |
| Framework  | Express 4                                          |
| Database   | MongoDB Atlas via Mongoose 8                       |
| Auth       | JWT verification (tokens issued by shell-services) |
| Email      | SendGrid                                           |
| Matching   | Skill-based scoring engine + skill extraction      |
| Validation | Zod                                                |
| Security   | Helmet, CORS, compression                          |
| Realtime   | WebSocket (ws) — live counts & public data feeds   |

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **MongoDB Atlas** connection string (pre-configured in env files)
- **shell-services** must be running (issues JWT tokens verified by this service)

### Install & Run

```powershell
# 1. Install dependencies
npm install

# 2. Seed the database (run once after cloning)
npm run seed

# 3. Start the dev server (hot-reload)
npm run dev
```

The server starts on **http://localhost:8001**.

### Seed Data

`npm run seed` populates the `matchdb-jobs` database with:

- **20 jobs** — across 3 vendors (w2, 1099, c2c; salary, hourly, contract; various locations)
- **10 candidate profiles** — full resumes with skills and experience
- **16 applications** — multiple statuses (accepted, reviewed, pending)
- **2 companies** — Alpha Staffing Solutions, Beta Tech Partners
- **12 marketer-candidate links** — accepted + pending invites
- **21 poke records** — pokes + emails, all directions (vendor↔candidate, marketer→vendor)
- **13 poke logs** — monthly rate-limit counters
- **9 forwarded openings** — marketer → candidate job forwards
- **3 company invites** — pending invitations
- **8 project financials** — active + completed, with taxes and margins
- **16 timesheets** — approved, submitted, draft statuses
- **8 interview invites** — pending + accepted

See the [root README](../README.md) for full test account credentials.

---

## Project Structure

```
matchdb-jobs-services/
├── src/
│   ├── index.ts               # Entry point — HTTP server + WebSocket upgrade routing
│   ├── app.ts                 # Express app (routes, middleware, Swagger)
│   ├── config/
│   │   ├── env.ts             # Environment variable loading & validation
│   │   ├── mongoose.ts        # MongoDB connection (Atlas)
│   │   └── swagger.ts         # OpenAPI 3.0 spec (all endpoints)
│   ├── models/
│   │   ├── Job.ts             # Job postings
│   │   ├── CandidateProfile.ts # Candidate resumes & profiles
│   │   ├── Application.ts     # Job applications
│   │   ├── PokeRecord.ts      # Poke interaction records
│   │   ├── PokeLog.ts         # Monthly poke rate-limit tracking
│   │   ├── Company.ts         # Marketer companies
│   │   ├── MarketerCandidate.ts # Marketer roster
│   │   ├── ForwardedOpening.ts # Jobs forwarded to candidates
│   │   ├── CompanyInvite.ts   # Marketer invite tokens
│   │   ├── ProjectFinancial.ts # Per-application financials
│   │   ├── Timesheet.ts       # Weekly timesheets
│   │   ├── InterviewInvite.ts # Interview scheduling
│   │   └── index.ts           # Barrel export
│   ├── controllers/
│   │   ├── jobs.controller.ts      # CRUD for jobs, profiles, applications, matching, pokes
│   │   ├── marketer.controller.ts  # Company, roster, forwarding, invites
│   │   ├── financials.controller.ts # Project financials, state tax rates, summaries
│   │   └── ingest.controller.ts    # Bulk job/profile ingestion (internal)
│   ├── middleware/
│   │   ├── auth.middleware.ts      # JWT verification guard
│   │   └── error.middleware.ts     # Global error handler + 404
│   ├── routes/
│   │   ├── jobs.routes.ts         # /api/jobs/*
│   │   ├── marketer.routes.ts     # /api/marketer/*
│   │   ├── timesheets.routes.ts   # /api/timesheets/*
│   │   └── interviews.routes.ts   # /api/interviews/*
│   ├── services/
│   │   ├── matching.service.ts       # Candidate-job matching algorithm
│   │   ├── skill-extractor.service.ts # Auto-extract skills from text
│   │   ├── sendgrid.service.ts       # Email dispatch
│   │   ├── sse.service.ts            # Server-Sent Events for live refresh
│   │   ├── ws-counts.service.ts      # WebSocket /ws/counts
│   │   └── ws-public-data.service.ts # WebSocket /ws/public-data
│   └── scripts/
│       └── seed.ts                 # Database seed script
├── env/
│   ├── .env.local             # Local dev env vars
│   ├── .env.development       # Dev env vars
│   ├── .env.qa                # QA env vars
│   └── .env.production        # Production env vars
├── Dockerfile
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

| Method | Path                                  | Auth     | Description                               |
| ------ | ------------------------------------- | -------- | ----------------------------------------- |
| GET    | `/api/marketer/stats`                 | Marketer | Dashboard stats                           |
| GET    | `/api/marketer/jobs`                  | Marketer | Browse available jobs                     |
| GET    | `/api/marketer/profiles`              | Marketer | Browse candidate profiles                 |
| POST   | `/api/marketer/company`               | Marketer | Register a company                        |
| GET    | `/api/marketer/company`               | Marketer | Get own company                           |
| GET    | `/api/marketer/company-summary`       | Marketer | Company financial/resource summary        |
| POST   | `/api/marketer/candidates`            | Marketer | Add candidate to roster                   |
| GET    | `/api/marketer/candidates`            | Marketer | List rostered candidates                  |
| GET    | `/api/marketer/candidates/:id/detail` | Marketer | Full candidate detail (profile, projects) |
| DELETE | `/api/marketer/candidates/:id`        | Marketer | Remove candidate from roster              |
| POST   | `/api/marketer/candidates/:id/invite` | Marketer | Send invite link to candidate             |
| POST   | `/api/marketer/forward`               | Marketer | Forward a job to a candidate              |
| POST   | `/api/marketer/forward-with-email`    | Marketer | Forward opening + send email notification |
| GET    | `/api/marketer/forwarded`             | Marketer | List forwarded openings                   |
| PATCH  | `/api/marketer/forwarded/:id/status`  | Marketer | Update forwarded opening status           |

### Financials

| Method | Path                                              | Auth     | Description                          |
| ------ | ------------------------------------------------- | -------- | ------------------------------------ |
| GET    | `/api/marketer/financials/states`                 | Marketer | US state tax rates                   |
| GET    | `/api/marketer/financials/summary`                | Marketer | Company-wide financial summary       |
| GET    | `/api/marketer/financials/candidate/:candidateId` | Marketer | Candidate financial records          |
| GET    | `/api/marketer/financials/:applicationId`         | Marketer | Get project financial record         |
| POST   | `/api/marketer/financials`                        | Marketer | Create/update project financial data |
| DELETE | `/api/marketer/financials/:applicationId`         | Marketer | Delete project financial record      |

### Timesheets

| Method | Path                          | Auth     | Description                   |
| ------ | ----------------------------- | -------- | ----------------------------- |
| GET    | `/api/timesheets/`            | Yes      | List timesheets for user      |
| POST   | `/api/timesheets/`            | Yes      | Create/update timesheet       |
| PATCH  | `/api/timesheets/:id/submit`  | Yes      | Submit timesheet for approval |
| PATCH  | `/api/timesheets/:id/approve` | Marketer | Approve a submitted timesheet |
| PATCH  | `/api/timesheets/:id/reject`  | Marketer | Reject a submitted timesheet  |

### Interviews

| Method | Path                          | Auth   | Description              |
| ------ | ----------------------------- | ------ | ------------------------ |
| GET    | `/api/interviews/`            | Yes    | List interview invites   |
| POST   | `/api/interviews/`            | Vendor | Create interview invite  |
| PATCH  | `/api/interviews/:id/respond` | Yes    | Accept/decline an invite |

### WebSocket Endpoints

| Path              | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| `/ws/counts`      | Broadcasts `{ jobs, profiles }` counts every 30 s          |
| `/ws/public-data` | Broadcasts full job + profile snapshots with diff tracking |

---

## Database (MongoDB Atlas)

This service connects to the `matchdb-jobs` database on MongoDB Atlas.
Schemas are defined as Mongoose models — no migrations needed.

### Collections (12 models)

- **Job** — Job postings with skills, location, salary, type
- **CandidateProfile** — Candidate resumes, skills, visibility config
- **Application** — Job applications with status tracking
- **PokeRecord** — Interaction notifications between users
- **PokeLog** — Monthly poke rate-limit tracking
- **Company** — Marketer companies
- **MarketerCandidate** — Marketer-candidate roster entries
- **ForwardedOpening** — Jobs forwarded to candidates
- **CompanyInvite** — Invite tokens with expiry
- **ProjectFinancial** — Per-application bill/pay rates and taxes
- **Timesheet** — Weekly timesheets with approval workflow
- **InterviewInvite** — Interview scheduling records

See [DATABASE-SCHEMA.md](../DATABASE-SCHEMA.md) for the full schema reference.

---

## Environment Variables

Config is loaded from `env/.env.{NODE_ENV}` files:

```env
PORT=8001
NODE_ENV=local
MONGO_URI=mongodb+srv://...@matchdb.rhutf6s.mongodb.net/matchdb-jobs?retryWrites=true&w=majority
JWT_SECRET=dev-jwt-secret-change-in-production-min-32-chars
SENDGRID_API_KEY=
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:4000,http://localhost:4001
CLIENT_URL=http://localhost:3000
```

> **Note:** `JWT_SECRET` must match the one used in `matchdb-shell-services` since tokens are issued there and verified here.

---

## Scripts

| Script          | Description                       |
| --------------- | --------------------------------- |
| `npm run dev`   | Start with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/`     |
| `npm start`     | Run compiled output               |
| `npm run seed`  | Seed the database with test data  |

---

## Skill Extraction

`skill-extractor.service.ts` auto-extracts skills from free-form text (resumes, job descriptions) using a curated list of ~150 keywords across: Languages, Frontend, Backend, Databases, Cloud/DevOps, Data/AI/ML, Tools, Mobile, Testing. Case-insensitive with word-boundary matching.

---

## API Documentation (Swagger)

Interactive API docs at **http://localhost:8001/api-docs**. All 63 endpoints are documented in the OpenAPI 3.0 spec (`src/config/swagger.ts`), organized by tags: Public, Candidate, Profile, Vendor, Shared, Resume, Jobs, Marketer, Financials, Timesheets, Interviews, Invites, Realtime, Internal.

---

## License

MIT
