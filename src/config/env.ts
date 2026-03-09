import dotenv from "dotenv";
import path from "path";

const ENV = process.env.NODE_ENV || "local";
dotenv.config({ path: path.resolve(__dirname, "../../env", `.env.${ENV}`) });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const env = {
  NODE_ENV: ENV,
  PORT: parseInt(process.env.PORT || "8001", 10),
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: required("JWT_SECRET"),
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || "",
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || "noreply@matchdb.io",
  SENDGRID_FROM_NAME: process.env.SENDGRID_FROM_NAME || "MatchDB",
  CORS_ORIGINS: (
    process.env.CORS_ORIGINS ||
    "http://localhost:3000,http://localhost:3001,http://localhost:4000,http://localhost:4001"
  ).split(","),
  // Internal ingest API — shared secret with matchdb-data-collection-mono
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || "matchdb-internal-dev-key",
  // System "vendor" identity used for collection-uploaded job postings
  SYSTEM_VENDOR_ID: process.env.SYSTEM_VENDOR_ID || "00000000-0000-0000-0000-000000000001",
  SYSTEM_VENDOR_EMAIL: process.env.SYSTEM_VENDOR_EMAIL || "system@matchdb.io",
};
