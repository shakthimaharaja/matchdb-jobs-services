import { env } from './config/env';
import { connectMongo } from './config/mongoose';
import app from './app';

async function main() {
  await connectMongo();

  app.listen(env.PORT, () => {
    console.log(`[Server] matchdb-jobs-services running on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

main().catch((err) => {
  console.error('[Fatal] Server failed to start:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  const mongoose = await import('mongoose');
  await mongoose.default.disconnect();
  process.exit(0);
});
