import dotenv from 'dotenv';
import path from 'path';

const ENV = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(__dirname, '../../env', `.env.${ENV}`) });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const env = {
  NODE_ENV: ENV,
  PORT: parseInt(process.env.PORT || '8001', 10),
  MONGO_URI: required('MONGO_URI'),
  MONGO_DB_NAME: process.env.MONGO_DB_NAME || 'matchdb_jobs',
  JWT_SECRET: required('JWT_SECRET'),
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || 'noreply@matchdb.io',
  SENDGRID_FROM_NAME: process.env.SENDGRID_FROM_NAME || 'MatchDB',
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://localhost:4000,http://localhost:4001').split(','),
};
