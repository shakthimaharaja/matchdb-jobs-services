import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import jobsRoutes from "./routes/jobs.routes";
import { swaggerSpec } from "./config/swagger";
import { errorHandler, notFound } from "./middleware/error.middleware";

const app = express();

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

app.use("/api/jobs", jobsRoutes);

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
