import express from "express";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import jobsRoutes from "./routes/jobs.routes";
import employerRoutes from "./routes/employer.routes";
import financialsRoutes from "./routes/financials.routes";
import employerFinancialsRoutes from "./routes/employerFinancials.routes";
import timesheetsRoutes from "./routes/timesheets.routes";
import interviewsRoutes from "./routes/interviews.routes";
import internalRoutes from "./routes/internal.routes";
import adminRoutes from "./routes/admin.routes";
import candidateInviteRoutes from "./routes/candidateInvite.routes";
import { swaggerSpec } from "./config/swagger";
import { errorHandler, notFound } from "./middleware/error.middleware";
import { requireAuth, requireCandidate } from "./middleware/auth.middleware";
import {
  listCompanies,
  getCandidateForwardedOpenings,
  getCandidateMyDetail,
  verifyInvite,
  acceptInvite,
  searchCompanies,
} from "./controllers/employer.controller";
import { addSSEClient } from "./services/sse.service";
import { getCounts } from "./services/poll-counts.service";
import { getPublicData } from "./services/poll-public-data.service";

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

// Gzip compression — reduces API response size 60-80%
app.use(compression());

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

// Public: list all companies (for candidate/vendor registration dropdowns)
app.get("/api/jobs/companies", listCompanies);

// Public: fuzzy search companies (for candidate registration dropdown)
app.get("/api/jobs/companies/search", searchCompanies);

// Public: verify invite token (no auth required)
app.get("/api/jobs/invite/:token", verifyInvite);

// Accept invite (requires auth — candidate must be logged in)
app.post("/api/jobs/invite/:token/accept", requireAuth, acceptInvite);

// Candidate: forwarded openings from their employer company
app.get(
  "/api/jobs/candidate/forwarded",
  requireCandidate,
  getCandidateForwardedOpenings,
);

app.use("/api/jobs/marketer", employerRoutes); // must be BEFORE /api/jobs to avoid :id collision
app.use("/api/jobs/marketer/financials", financialsRoutes);
app.use("/api/jobs/vendor/financials", employerFinancialsRoutes);
app.use("/api/jobs/timesheets", timesheetsRoutes);
app.use("/api/jobs/interviews", interviewsRoutes);
app.use("/api/jobs/admin", adminRoutes);

// Candidate named routes — MUST be before candidateInviteRoutes (which has /:id catch-all)
app.get(
  "/api/jobs/candidate/my-detail",
  requireCandidate,
  getCandidateMyDetail,
);

app.use("/api/jobs/candidate", candidateInviteRoutes);

// Polling endpoints (replaced WebSocket) — must be BEFORE jobsRoutes to avoid :id collision
app.get("/api/jobs/poll/counts", getCounts);
app.get("/api/jobs/poll/public-data", getPublicData);

// SSE: real-time push to dashboard clients — fires when ingest writes new data
app.get("/api/jobs/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no", // disable nginx buffering in production
    Connection: "keep-alive",
  });
  res.flushHeaders();
  // Send initial comment so the browser EventSource opens immediately
  res.write(": connected\n\n");
  addSSEClient(res);
});

app.use("/api/jobs", jobsRoutes);

// Internal: service-to-service ingest (data-collection → MongoDB)
app.use("/api/internal", internalRoutes);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "matchdb-jobs-services",
    env: env.NODE_ENV,
  });
});

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "MatchDB Jobs Services — API Docs",
  }),
);

app.use(notFound);
app.use(errorHandler);

export default app;
