import mongoose from 'mongoose';
import { config } from './env.js';

let connectionPromise;

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connectionPromise) {
    const pending = mongoose.connect(config.mongoUri)
      .then(() => mongoose.connection)
      .finally(() => {
        if (connectionPromise === pending) connectionPromise = undefined;
      });
    connectionPromise = pending;
  }
  return connectionPromise;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  connectionPromise = undefined;
}
