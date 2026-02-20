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
| Security   | Helmet, CORS                                       |

---

## Project Structure

```
matchdb-jobs-services/
├── src/
│   ├── index.ts              # Entry point — connects MongoDB, starts server
│   ├── app.ts                # Express app (routes, middleware, Swagger)
│   ├── config/
│   │   ├── env.ts            # Environment variable loading & validation
│   │   ├── mongoose.ts       # MongoDB connection helper
│   │   └── swagger.ts        # OpenAPI 3.0 spec (all endpoints)
│   ├── controllers/
│   │   └── jobs.controller.ts     # CRUD for jobs, profiles, applications, matching, resume
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
│       └── sendgrid.service.ts       # Email dispatch
├── seed.ts                   # Create demo jobs, profiles (with resumes), applications
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
| POST   | `/api/jobs/`                          | Vendor    | Create a new job                    |
| GET    | `/api/jobs/:id`                       | Yes       | Get job details                     |
| PUT    | `/api/jobs/:id`                       | Vendor    | Update a job (owner only)           |
| DELETE | `/api/jobs/:id`                       | Vendor    | Delete a job (owner only)           |
| PATCH  | `/api/jobs/:id/close`                 | Vendor    | Close/deactivate a job              |
| PATCH  | `/api/jobs/:id/reopen`                | Vendor    | Reopen a closed job                 |
| GET    | `/api/jobs/vendor/mine`               | Vendor    | Get vendor's own jobs               |
| GET    | `/api/jobs/profiles/`                 | Yes       | List candidate profiles             |
| GET    | `/api/jobs/profiles-public`           | No        | List publicly visible profiles      |
| POST   | `/api/jobs/profiles/`                 | Candidate | Create / update own profile         |
| GET    | `/api/jobs/profiles/me`               | Candidate | Get own candidate profile           |
| POST   | `/api/jobs/applications/`             | Candidate | Apply to a job                      |
| GET    | `/api/jobs/applications/mine`         | Candidate | Get own applications                |
| GET    | `/api/jobs/applications/job/:id`      | Vendor    | Get applications for a job          |
| PATCH  | `/api/jobs/applications/:id/status`   | Vendor    | Update application status           |
| GET    | `/api/jobs/match/:jobId`              | Vendor    | Match candidates to a job           |
| GET    | `/api/jobs/jobmatches`                | Candidate | Ranked job matches for candidate    |
| GET    | `/api/jobs/profilematches`            | Vendor    | Ranked candidate matches for vendor |
| POST   | `/api/jobs/poke`                      | Yes       | Send a poke notification            |
| GET    | `/api/jobs/resume/:username`          | No        | Public profile by username          |
| GET    | `/api/jobs/resume/:username/download` | Yes       | Download candidate resume           |
| GET    | `/health`                             | No        | Health check                        |

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

---

## Skill Extraction

The `skill-extractor.service.ts` auto-extracts skills from free-form text (resumes, job descriptions) using a curated list of ~150 keywords across: Languages, Frontend, Backend, Databases, Cloud/DevOps, Data/AI/ML, Tools, Mobile, Testing. Case-insensitive with word-boundary matching.

---

## Seed Data

Creates 19 jobs, 10 candidate profiles (with full resume data), and 25 applications. Profile IDs are synced with shell-services seed users. Each candidate profile includes `resumeSummary`, `resumeExperience`, `resumeEducation`, `resumeAchievements`, and `visibilityConfig`.

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
