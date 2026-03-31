# matchdb-jobs-services

Jobs, Candidate Profiles, Applications, Matching, Pokes, Employer RBAC & Company Admin backend for the MatchDB staffing platform. Uses **MongoDB Atlas** via Mongoose.

---

## Tech Stack

| Layer      | Technology                                                            |
| ---------- | --------------------------------------------------------------------- |
| Runtime    | Node.js + TypeScript                                                  |
| Framework  | Express 4                                                             |
| Database   | MongoDB Atlas via Mongoose 8                                          |
| Auth       | JWT verification (tokens issued by shell-services)                    |
| Email      | SendGrid                                                              |
| Matching   | Skill-based scoring engine + skill extraction                         |
| Validation | Zod                                                                   |
| RBAC       | Role-based access control (admin, manager, vendor, marketer)          |
| Security   | Helmet, CORS, compression, rate-limiting                              |
| Realtime   | Polling endpoints + SSE (live counts, public data, dashboard refresh) |

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
- **12 employer-candidate links** — accepted + pending invites
- **21 poke records** — pokes + emails, all directions (vendor↔candidate, employer→vendor)
- **13 poke logs** — monthly rate-limit counters
- **9 forwarded openings** — employer → candidate job forwards
- **3 company invites** — pending invitations
- **8 project financials** — active + completed, with taxes and margins
- **16 timesheets** — approved, submitted, draft statuses
- **8 interview invites** — pending + accepted
- **4 subscription plans** — starter, growth, business, enterprise

See the [root README](../README.md) for full test account credentials.

---

## Project Structure

```
matchdb-jobs-services/
├── src/
│   ├── index.ts               # Entry point — starts Express server
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
│   │   ├── Company.ts         # Employer companies
│   │   ├── EmployerCandidate.ts # Employer-candidate roster
│   │   ├── ForwardedOpening.ts # Jobs forwarded to candidates
│   │   ├── CompanyInvite.ts   # Candidate invite tokens
│   │   ├── ProjectFinancial.ts # Per-application financials
│   │   ├── Timesheet.ts       # Weekly timesheets
│   │   ├── InterviewInvite.ts # Interview scheduling
│   │   ├── CompanyAdmin.ts    # Company admin config & seat usage
│   │   ├── CompanyUser.ts     # RBAC users with roles & permissions
│   │   ├── EmployeeInvitation.ts # Employee invite tokens (72h expiry)
│   │   ├── ClientCompany.ts   # Client company relationships
│   │   ├── VendorCompany.ts   # Vendor company relationships
│   │   ├── SubscriptionPlan.ts # Subscription tiers & limits
│   │   ├── Counter.ts         # Auto-increment ID sequences (CND/WKR/CMP)
│   │   └── index.ts           # Barrel export
│   ├── controllers/
│   │   ├── jobs.controller.ts              # CRUD for jobs, profiles, applications, matching, pokes
│   │   ├── employer.controller.ts          # Company, roster, forwarding, invites, client/vendor companies
│   │   ├── employerFinancials.controller.ts # Employer-side financial summary
│   │   ├── financials.controller.ts        # Project financials, state tax rates, summaries
│   │   └── ingest.controller.ts            # Bulk job/profile ingestion (internal)
│   ├── middleware/
│   │   ├── auth.middleware.ts      # JWT verification guard (requireAuth, requireVendor, requireCandidate, requireEmployer, requireMarketer)
│   │   ├── rbac.middleware.ts      # RBAC guards (requireRole, requirePermission, requireSeatAvailable, resolveCompanyUser)
│   │   └── error.middleware.ts     # Global error handler + 404
│   ├── routes/
│   │   ├── jobs.routes.ts              # /api/jobs/*
│   │   ├── employer.routes.ts          # /api/jobs/marketer/* (employer operations)
│   │   ├── employerFinancials.routes.ts # /api/jobs/vendor/financials/*
│   │   ├── financials.routes.ts        # /api/jobs/marketer/financials/*
│   │   ├── timesheets.routes.ts        # /api/jobs/timesheets/*
│   │   ├── interviews.routes.ts        # /api/jobs/interviews/*
│   │   ├── admin.routes.ts             # /api/jobs/admin/* (RBAC, invites, user mgmt)
│   │   └── candidateInvite.routes.ts   # /api/jobs/candidate/* (invite acceptance)
│   ├── services/
│   │   ├── matching.service.ts       # Candidate-job matching algorithm
│   │   ├── skill-extractor.service.ts # Auto-extract skills from text
│   │   ├── sendgrid.service.ts       # Email dispatch
│   │   ├── sse.service.ts            # Server-Sent Events for live refresh
│   │   ├── poll-counts.service.ts    # GET /api/jobs/poll/counts
│   │   └── poll-public-data.service.ts # GET /api/jobs/poll/public-data
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

### Employer (Operations)

| Method | Path                                  | Auth     | Description                                     |
| ------ | ------------------------------------- | -------- | ----------------------------------------------- |
| GET    | `/api/marketer/stats`                 | Employer | Dashboard stats                                 |
| GET    | `/api/marketer/jobs`                  | Employer | Browse available jobs (paginated)                |
| GET    | `/api/marketer/profiles`              | Employer | Browse candidate profiles (paginated)            |
| POST   | `/api/marketer/company`               | Employer | Register a company                              |
| GET    | `/api/marketer/company`               | Employer | Get own company                                 |
| GET    | `/api/marketer/company-summary`       | Employer | Company financial/resource summary              |
| GET    | `/api/marketer/client-companies`      | Employer | List client companies                           |
| GET    | `/api/marketer/vendor-companies`      | Employer | List vendor companies                           |
| POST   | `/api/marketer/candidates`            | Employer | Add candidate to roster                         |
| GET    | `/api/marketer/candidates`            | Employer | List rostered candidates                        |
| GET    | `/api/marketer/candidates/:id/detail` | Employer | Full candidate detail (profile, projects)        |
| DELETE | `/api/marketer/candidates/:id`        | Employer | Remove candidate from roster                    |
| POST   | `/api/marketer/candidates/:id/invite` | Employer | Send invite link to candidate                   |
| POST   | `/api/marketer/forward`               | Employer | Forward a job to a candidate                    |
| POST   | `/api/marketer/forward-with-email`    | Employer | Forward opening + send email notification       |
| GET    | `/api/marketer/forwarded`             | Employer | List forwarded openings                         |
| PATCH  | `/api/marketer/forwarded/:id/status`  | Employer | Update forwarded opening status                 |

### Financials (Marketer)

| Method | Path                                              | Auth     | Description                          |
| ------ | ------------------------------------------------- | -------- | ------------------------------------ |
| GET    | `/api/marketer/financials/states`                 | Marketer | US state tax rates                   |
| GET    | `/api/marketer/financials/summary`                | Marketer | Company-wide financial summary       |
| GET    | `/api/marketer/financials/candidate/:candidateId` | Marketer | Candidate financial records          |
| GET    | `/api/marketer/financials/:applicationId`         | Marketer | Get project financial record         |
| POST   | `/api/marketer/financials`                        | Marketer | Create/update project financial data |
| DELETE | `/api/marketer/financials/:applicationId`         | Marketer | Delete project financial record      |

### Financials (Employer)

| Method | Path                              | Auth     | Description                  |
| ------ | --------------------------------- | -------- | ---------------------------- |
| GET    | `/api/vendor/financials/summary`  | Employer | Employer financial summary   |

### Admin (Company RBAC)

| Method | Path                            | Auth     | Description                                  |
| ------ | ------------------------------- | -------- | -------------------------------------------- |
| GET    | `/api/admin/plans`              | No       | List available subscription plans            |
| POST   | `/api/admin/setup`              | Yes      | One-time company admin onboarding            |
| GET    | `/api/admin/me`                 | Yes      | Get current user's company context + RBAC    |
| POST   | `/api/admin/invite`             | Admin    | Send employee invitation email               |
| GET    | `/api/admin/invitations`        | Admin    | List sent invitations                        |
| DELETE | `/api/admin/invitations/:id`    | Admin    | Revoke a pending invitation                  |
| POST   | `/api/admin/register/:token`    | No       | Register via employee invite token           |
| GET    | `/api/admin/users`              | Yes      | List company users (RBAC-filtered)           |
| PATCH  | `/api/admin/users/:id/role`     | Admin    | Change a user's role + department            |
| PATCH  | `/api/admin/users/:id/status`   | Admin    | Activate / deactivate a user                 |
| GET    | `/api/admin/active-users`       | Yes      | List active users with online status         |

### Timesheets

| Method | Path                           | Auth     | Description                         |
| ------ | ------------------------------ | -------- | ----------------------------------- |
| GET    | `/api/timesheets/`             | Yes      | List timesheets for user            |
| POST   | `/api/timesheets/`             | Yes      | Create/update timesheet             |
| PATCH  | `/api/timesheets/:id/submit`   | Yes      | Submit timesheet for approval       |
| GET    | `/api/timesheets/pending`      | Marketer | List submitted timesheets from roster |
| PATCH  | `/api/timesheets/:id/approve`  | Marketer | Approve a submitted timesheet       |
| PATCH  | `/api/timesheets/:id/reject`   | Marketer | Reject a submitted timesheet        |

### Interviews

| Method | Path                          | Auth   | Description              |
| ------ | ----------------------------- | ------ | ------------------------ |
| GET    | `/api/interviews/`            | Yes    | List interview invites   |
| POST   | `/api/interviews/`            | Vendor | Create interview invite  |
| PATCH  | `/api/interviews/:id/respond` | Yes    | Accept/decline an invite |

### Candidate

| Method | Path                            | Auth      | Description                                      |
| ------ | ------------------------------- | --------- | ------------------------------------------------ |
| GET    | `/api/jobs/candidate/my-detail` | Candidate | Full candidate detail (profile, projects, forwards) |
| GET    | `/api/jobs/candidate/forwarded` | Candidate | List job openings forwarded by employer           |

### Invites

| Method | Path                                  | Auth | Description                 |
| ------ | ------------------------------------- | ---- | --------------------------- |
| GET    | `/api/jobs/companies`                 | No   | List all companies          |
| GET    | `/api/jobs/companies/search`          | No   | Fuzzy search companies      |
| GET    | `/api/jobs/invite/:token`             | No   | Verify an invite token      |
| POST   | `/api/jobs/invite/:token/accept`      | Yes  | Accept an invite            |

### Polling Endpoints

| Method | Path                         | Description                                                                 |
| ------ | ---------------------------- | --------------------------------------------------------------------------- |
| GET    | `/api/jobs/poll/counts`      | Returns `{ jobs, profiles }` counts                                         |
| GET    | `/api/jobs/poll/public-data` | Returns job + profile snapshots with diff tracking (changedIds, deletedIds) |

---

## Database (MongoDB Atlas)

This service connects to the `matchdb-jobs` database on MongoDB Atlas.
Schemas are defined as Mongoose models — no migrations needed.

### Collections (20 models)

- **Job** — Job postings with skills, location, salary, type
- **CandidateProfile** — Candidate resumes, skills, visibility config
- **Application** — Job applications with status tracking
- **PokeRecord** — Interaction notifications between users
- **PokeLog** — Monthly poke rate-limit tracking
- **Company** — Employer companies
- **EmployerCandidate** — Employer-candidate roster entries (collection: `marketercandidates`)
- **ForwardedOpening** — Jobs forwarded to candidates
- **CompanyInvite** — Candidate invite tokens with expiry
- **ProjectFinancial** — Per-application bill/pay rates and taxes
- **Timesheet** — Weekly timesheets with approval workflow
- **InterviewInvite** — Interview scheduling records
- **CompanyAdmin** — Company admin config, seat usage, subscription plan ref
- **CompanyUser** — RBAC users with role, department, permissions, online status
- **EmployeeInvitation** — Employee invite tokens (72h expiry, role + department assignment)
- **ClientCompany** — Client company relationships per employer
- **VendorCompany** — Vendor company relationships per employer
- **SubscriptionPlan** — Tiered plans (starter, growth, business, enterprise)
- **Counter** — Auto-increment sequence generator (CND-0001, WKR-0001, CMP-0001)

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
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
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

Interactive API docs at **http://localhost:8001/api-docs**. All endpoints are documented in the OpenAPI 3.0 spec (`src/config/swagger.ts`), organized by tags: Public, Candidate, Profile, Vendor, Shared, Resume, Jobs, Employer, Financials, Timesheets, Interviews, Invites, Admin, Realtime, Internal.

---

## License

MIT
