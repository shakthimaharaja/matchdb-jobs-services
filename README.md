# matchdb-jobs-services

Jobs, Candidate Profiles & Applications backend for the MatchDB staffing platform.

## Tech Stack

| Layer      | Technology                                         |
| ---------- | -------------------------------------------------- |
| Runtime    | Node.js + TypeScript                               |
| Framework  | Express 4                                          |
| Database   | MongoDB via Mongoose 8                             |
| Auth       | JWT verification (tokens issued by shell-services) |
| Email      | SendGrid                                           |
| Validation | Zod                                                |
| Security   | Helmet, CORS                                       |

## Project Structure

```
matchdb-jobs-services/
├── src/
│   ├── index.ts              # Entry point — connects MongoDB, starts server
│   ├── app.ts                # Express app setup (routes, middleware)
│   ├── config/
│   │   ├── env.ts            # Environment variable loading & validation
│   │   └── mongoose.ts       # MongoDB connection helper
│   ├── controllers/
│   │   └── jobs.controller.ts     # CRUD for jobs, profiles, applications, matching
│   ├── middleware/
│   │   ├── auth.middleware.ts     # JWT verification guard
│   │   └── error.middleware.ts    # Global error handler + 404
│   ├── models/
│   │   ├── Job.model.ts          # Job posting schema
│   │   ├── CandidateProfile.model.ts # Candidate profile schema
│   │   └── Application.model.ts  # Job application schema
│   ├── routes/
│   │   └── jobs.routes.ts        # /api/jobs/*
│   └── services/
│       ├── matching.service.ts   # Candidate-job matching algorithm
│       └── sendgrid.service.ts   # Email dispatch
├── seed.ts                   # Create demo jobs, profiles, applications
├── env/
│   └── .env.development      # Local env vars (create from template below)
├── package.json
└── tsconfig.json
```

## API Endpoints

| Method | Path                                | Auth | Description                    |
| ------ | ----------------------------------- | ---- | ------------------------------ |
| GET    | `/api/jobs/`                        | No   | List all active jobs           |
| POST   | `/api/jobs/`                        | Yes  | Create a new job (vendor only) |
| GET    | `/api/jobs/:id`                     | Yes  | Get job details                |
| PUT    | `/api/jobs/:id`                     | Yes  | Update a job (owner only)      |
| DELETE | `/api/jobs/:id`                     | Yes  | Delete a job (owner only)      |
| GET    | `/api/jobs/vendor/mine`             | Yes  | Get vendor's own jobs          |
| GET    | `/api/jobs/profiles/`               | Yes  | List candidate profiles        |
| POST   | `/api/jobs/profiles/`               | Yes  | Create / update own profile    |
| GET    | `/api/jobs/profiles/me`             | Yes  | Get own candidate profile      |
| POST   | `/api/jobs/applications/`           | Yes  | Apply to a job                 |
| GET    | `/api/jobs/applications/mine`       | Yes  | Get own applications           |
| GET    | `/api/jobs/applications/job/:id`    | Yes  | Get applications for a job     |
| PATCH  | `/api/jobs/applications/:id/status` | Yes  | Update application status      |
| GET    | `/api/jobs/match/:jobId`            | Yes  | Match candidates to a job      |
| GET    | `/health`                           | No   | Health check                   |

## Data Models

### Job

`title`, `description`, `vendorId`, `vendorEmail`, `recruiterName`, `recruiterPhone`, `location`, `jobType` (full_time / contract), `salaryMin`, `salaryMax`, `payPerHour`, `skillsRequired[]`, `experienceRequired`, `isActive`

### CandidateProfile

`candidateId`, `name`, `email`, `phone`, `currentCompany`, `currentRole`, `preferredJobType`, `expectedHourlyRate`, `experienceYears`, `skills[]`, `location`, `bio`

### Application

`jobId`, `jobTitle`, `candidateId`, `candidateEmail`, `coverLetter`, `status` (pending / reviewed / accepted / rejected)

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **MongoDB** running locally on port 27017 (or a remote URI)

## Environment Variables

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

## Getting Started

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

## Available Scripts

| Script          | Description                       |
| --------------- | --------------------------------- |
| `npm run dev`   | Start with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/`     |
| `npm start`     | Run compiled output               |
