import mongoose from 'mongoose';
import { env } from './env';

export async function connectMongo(): Promise<void> {
  await mongoose.connect(env.MONGO_URI, { dbName: env.MONGO_DB_NAME });
  console.log('[DB] MongoDB connected via Mongoose');
}
