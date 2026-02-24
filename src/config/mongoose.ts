import mongoose from 'mongoose';
import { env } from './env';

const isProd = env.NODE_ENV === 'production';

export async function connectMongo(): Promise<void> {
  await mongoose.connect(env.MONGO_URI, {
    dbName:                    env.MONGO_DB_NAME,
    // Connection pool — each PM2 worker gets its own pool
    maxPoolSize:               isProd ? 20 : 5,
    minPoolSize:               isProd ? 2  : 1,
    // Atlas timeouts (ms)
    serverSelectionTimeoutMS:  5_000,
    socketTimeoutMS:           45_000,
    connectTimeoutMS:          10_000,
    // Heartbeat — keeps idle connections alive through Atlas idle timeout (5 min)
    heartbeatFrequencyMS:      30_000,
  });
  console.log('[DB] MongoDB Atlas connected via Mongoose');

  mongoose.connection.on('error', (err) => {
    console.error('[DB] MongoDB connection error:', err);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected — will auto-reconnect');
  });
}
