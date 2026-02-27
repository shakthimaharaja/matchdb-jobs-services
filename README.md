# matchdb-jobs-services

Jobs, Candidate Profiles, Applications, Matching & Resume backend for the MatchDB staffing platform.

---

## Tech Stack

| Layer      | Technology                                         |
| ---------- | -------------------------------------------------- |
| Runtime    | Node.js + TypeScript                               |
| Framework  | Express 4                                          |
| Database   | MongoDB via Mongoose 8                             |
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
├── src/
│   ├── index.ts              # Entry point — HTTP server + WebSocket upgrade routing
│   ├── app.ts                # Express app (routes, middleware, Swagger)
│   ├── config/
│   │   ├── env.ts            # Environment variable loading & validation
│   │   ├── mongoose.ts       # MongoDB connection helper
│   │   └── swagger.ts        # OpenAPI 3.0 spec (all endpoints)
│   ├── controllers/
│   │   └── jobs.controller.ts     # CRUD for jobs, profiles, applications, matching, resume, pokes
│   ├── middleware/
│   │   ├── auth.middleware.ts     # JWT verification guard (reads username from token)
│   │   └── error.middleware.ts    # Global error handler + 404
│   ├── models/
│   │   ├── Job.model.ts              # Job posting schema
│   │   ├── CandidateProfile.model.ts # Candidate profile + resume schema
│   │   ├── Application.model.ts      # Job application schema
│   │   ├── PokeLog.model.ts          # Monthly poke rate-limit tracking
│   │   └── PokeRecord.model.ts       # Poke interaction records
│   ├── routes/
│   │   └── jobs.routes.ts        # /api/jobs/*
│   └── services/
│       ├── matching.service.ts       # Candidate-job matching algorithm
│       ├── skill-extractor.service.ts # Auto-extract skills from text (~150 keywords)
│       ├── sendgrid.service.ts       # Email dispatch
│       ├── ws-counts.service.ts      # WebSocket /ws/counts — live job & profile counts
│       └── ws-public-data.service.ts # WebSocket /ws/public-data — live data snapshots with diffs
├── seed.ts                   # Create demo jobs, profiles (with resumes), applications
├── seed-10k.ts               # Mass seeder — 10K jobs, 10K profiles, ~5K applications
├── env/
│   └── .env.development      # Local env vars
├── package.json
└── tsconfig.json
```

---

## API Endpoints

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

### WebSocket Endpoints

| Path              | Description                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `/ws/counts`      | Broadcasts `{ jobs, profiles }` counts every 30 s with jitter simulation                 |
| `/ws/public-data` | Broadcasts full job + profile snapshots every 30 s with diff tracking (changed, deleted) |

The HTTP server routes WebSocket `upgrade` requests by pathname to the appropriate `ws.Server` instance (`noServer` mode).

---

## Data Models

### Job

`title`, `description`, `vendorId`, `vendorEmail`, `recruiterName`, `recruiterPhone`, `location`, `jobType` (full_time / contract), `subType` (c2c / c2h / w2 / 1099 / direct_hire / salary), `salaryMin`, `salaryMax`, `payPerHour`, `skillsRequired[]`, `experienceRequired`, `workMode` (onsite / remote / hybrid), `isActive`

### CandidateProfile

`candidateId`, `username`, `name`, `email`, `phone`, `currentCompany`, `currentRole`, `preferredJobType`, `expectedHourlyRate`, `experienceYears`, `skills[]`, `location`, `bio`, `resumeSummary`, `resumeExperience`, `resumeEducation`, `resumeAchievements`, `visibilityConfig` (domain→subdomain map), `profileLocked`

### Application

`jobId`, `jobTitle`, `candidateId`, `candidateEmail`, `coverLetter`, `status` (pending / reviewed / accepted / rejected)

### PokeLog

Rate-limits poke interactions per user per month:
`userId`, `yearMonth` (YYYY-MM format), `count` — unique compound index on `(userId, yearMonth)`

### PokeRecord

Tracks individual poke interactions between users:
`fromUserId`, `toUserId`, `fromUserType`, `toUserType`, `jobId?`, `message?`, `createdAt`

---

## Skill Extraction

The `skill-extractor.service.ts` auto-extracts skills from free-form text (resumes, job descriptions) using a curated list of ~150 keywords across: Languages, Frontend, Backend, Databases, Cloud/DevOps, Data/AI/ML, Tools, Mobile, Testing. Case-insensitive with word-boundary matching.

---

## Seed Data

The default `seed.ts` creates 19 jobs, 10 candidate profiles (with full resume data), and 25 applications. Profile IDs are synced with shell-services seed users. Each candidate profile includes `resumeSummary`, `resumeExperience`, `resumeEducation`, `resumeAchievements`, and `visibilityConfig`.

For load testing, `seed-10k.ts` creates 10,000 jobs + 10,000 profiles + ~5,000 applications + ~2,000 poke records using batched `insertMany` (1,000 per batch).

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **MongoDB** running locally on port 27017 (or a remote URI)

### Environment Variables

Create `env/.env.development`:

```env
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=matchdb_jobs
JWT_SECRET=dev-jwt-secret-change-in-production-min-32-chars
PORT=8001

# Optional
SENDGRID_API_KEY=
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:4000,http://localhost:4001
```

> **Note:** The `JWT_SECRET` must match the one used in `matchdb-shell-services` since tokens are issued there and verified here.

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Make sure MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# 3. Seed demo data (jobs, profiles, applications)
npx tsx seed.ts

# 4. Start the dev server (hot-reload)
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

## API Documentation (Swagger)

Interactive API docs are available at **http://localhost:8001/api-docs** when the server is running. The OpenAPI 3.0 spec is defined inline in `src/config/swagger.ts` and covers all jobs, profiles, applications, matching, resume, and poke endpoints with request/response schemas.

---

## License

MIT
