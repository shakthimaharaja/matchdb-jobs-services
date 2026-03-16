import mongoose from "mongoose";
import { env } from "./env";

export async function connectMongo(): Promise<void> {
  const uri = env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set");
  await mongoose.connect(uri);
  console.log("[MongoDB] Connected to", uri.replace(/\/\/[^@]+@/, "//***@"));
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
