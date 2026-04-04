# MatchingDB Jobs Services — Copilot Rules

## Project Overview

This is the **Jobs, Matching, Marketer & Financials API** for the MatchingDB staffing platform. It runs on **port 8001** and handles job postings, candidate profiles, skill-based matching, marketer company management, project financials, timesheets, and interviews.

**Stack:** Node.js, Express, TypeScript, Mongoose 8, MongoDB Atlas, SendGrid, WebSocket, SSE

---

## Scripts

| Command         | Purpose                                        |
| --------------- | ---------------------------------------------- |
| `npm run dev`   | Start dev server with hot-reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/`                  |
| `npm start`     | Run the compiled production build              |
| `npm run seed`  | Seed the database with test data               |

## Running the Application

Use VS Code tasks (`Ctrl+Shift+B`) or the PowerShell script:

```powershell
# From the MatchingDB workspace root:
.\start-matchdb.ps1
```

## Committing & Pushing

Always use the shared push script from the workspace root:

```powershell
# From the MatchingDB workspace root:
.\push-all.ps1
```

---

## Code Conventions

### File Structure

```
src/
  app.ts              # Express app setup, middleware, route mounting
  index.ts            # Server entry point (connects DB, starts listening)
  config/             # env.ts, swagger.ts
  controllers/        # Route handlers — one file per domain
    jobs.controller.ts
    marketer.controller.ts
    financials.controller.ts
    ingest.controller.ts
  middleware/          # auth.middleware.ts, error.middleware.ts
  models/             # Mongoose schemas — one file per collection
  routes/             # Express routers — one file per domain
    jobs.routes.ts          → /api/jobs
    marketer.routes.ts      → /api/jobs/marketer
    financials.routes.ts    → /api/jobs/marketer/financials
    timesheets.routes.ts    → /api/jobs/timesheets
    interviews.routes.ts    → /api/jobs/interviews
    internal.routes.ts      → /api/internal
  services/           # Business logic (matching, email, SSE)
  scripts/            # seed.ts
```

### Naming

- Files: `kebab-case.ts`
- Models: `PascalCase` (e.g., `Job`, `CandidateProfile`, `Application`)
- Route files: `{domain}.routes.ts`
- Controller files: `{domain}.controller.ts`

### API Patterns

- All routes use `/api/jobs/` prefix (except internal → `/api/internal/`)
- Role-based middleware: `requireAuth`, `requireVendor`, `requireCandidate`, `requireMarketer`
- Public routes have no auth middleware
- SSE endpoint at `/api/jobs/events` for live data push
- Error responses: `{ error: string }` with appropriate HTTP status
- Pagination: `?page=1&limit=25` params, response includes `{ data: [], total: number }`

### Three User Roles

| Role      | Middleware         | Description                                     |
| --------- | ------------------ | ----------------------------------------------- |
| Candidate | `requireCandidate` | Browse matched jobs, manage profile, timesheets |
| Vendor    | `requireVendor`    | Post jobs, browse candidates, send interviews   |
| Marketer  | `requireMarketer`  | Company roster, financials, forward openings    |

### Environment

- Config loaded from `env/.env.local` (dev)
- `JWT_SECRET` must match with shell-services
- MongoDB Atlas — database name: `matchingdb-jobs`

### Swagger

- All endpoints must have JSDoc swagger annotations
- Swagger UI at `/api-docs`
- Schemas defined in `src/config/swagger.ts`
- Use `@swagger` JSDoc blocks above each route handler

---

## Database Collections (matchdb-jobs)

| Collection         | Model             | Description                       |
| ------------------ | ----------------- | --------------------------------- |
| jobs               | Job               | Job postings from vendors         |
| candidateprofiles  | CandidateProfile  | Candidate resumes & skills        |
| applications       | Application       | Job applications                  |
| companies          | Company           | Marketer companies                |
| marketercandidates | MarketerCandidate | Company ↔ candidate roster        |
| forwardedopenings  | ForwardedOpening  | Marketer → candidate job forwards |
| companyinvites     | CompanyInvite     | Pending company invitations       |
| projectfinancials  | ProjectFinancial  | Bill/pay rates, hours, taxes      |
| pokerecords        | PokeRecord        | Poke/email interactions           |
| pokelogs           | PokeLog           | Monthly rate limiting             |
| timesheets         | Timesheet         | Weekly hour submissions           |
| interviewinvites   | InterviewInvite   | Vendor → candidate interviews     |

---

## Do NOT

- Add `console.log` — use structured error responses
- Store secrets in code — use env vars
- Skip Swagger annotations on new endpoints
- Use `any` type — define proper TypeScript interfaces
- Modify auth middleware without coordinating with shell-services
- Add inline route definitions in `app.ts` — use route files
