import mongoose from 'mongoose';
import { config } from './environment.js';

let mongodInstance: any = null;

export async function connectDatabase(): Promise<string> {
  let uri = config.mongodbUri;

  if (uri) {
    try {
      console.log(`[Database] Attempting connection to MongoDB at: ${uri}`);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      console.log('[Database] Connected to external MongoDB successfully');
      return uri;
    } catch (err: any) {
      console.warn(`[Database] Failed to connect to ${uri}: ${err.message}`);
      if (config.nodeEnv === 'production') {
        throw err;
      }
      console.log('[Database] Falling back to embedded MongoMemoryServer for development...');
    }
  }

  // Fallback to MongoMemoryServer for local zero-config execution
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongodInstance = await MongoMemoryServer.create();
    uri = mongodInstance.getUri();
    await mongoose.connect(uri);
    console.log(`[Database] Connected to embedded MongoDB memory server: ${uri}`);
    return uri;
  } catch (err: any) {
    console.error('[Database] Failed to initialize embedded MongoDB:', err.message);
    throw err;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
  console.log('[Database] Disconnected from MongoDB');
}
