import bcrypt from 'bcryptjs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import User from '../models/User.js';

export function readAdminCredentials(environment = process.env) {
  const email = environment.DEMO_ADMIN_EMAIL?.trim().toLowerCase();
  const password = environment.DEMO_ADMIN_PASSWORD;
  const mongoUri = environment.MONGODB_URI || 'mongodb://127.0.0.1:27017/resq';
  let localDemoDatabase = false;
  try {
    localDemoDatabase = environment.NODE_ENV !== 'production'
      && ['localhost', '127.0.0.1', '::1'].includes(new URL(mongoUri).hostname);
  } catch {
    localDemoDatabase = false;
  }
  const minimumPasswordLength = localDemoDatabase ? 8 : 16;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('DEMO_ADMIN_EMAIL must be a valid email address.');
  }
  if (!password || password.length < minimumPasswordLength) {
    throw new Error(`DEMO_ADMIN_PASSWORD is required and must be at least ${minimumPasswordLength} characters.`);
  }
  return { email, password };
}

export async function seedAdminAccount({ email, password } = readAdminCredentials()) {
  const existing = await User.findOne({ email }).select('role');
  if (existing) {
    if (existing.role !== 'admin') {
      throw new Error('The configured admin email already belongs to a non-admin account.');
    }
    return { created: false, userId: String(existing._id) };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await User.create({ name: 'ResQ Administrator', email, passwordHash, role: 'admin' });
    return { created: true, userId: String(user._id) };
  } catch (error) {
    if (error?.code === 11000) {
      throw new Error('An account with the configured admin email already exists.');
    }
    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  Promise.resolve()
    .then(() => readAdminCredentials())
    .then((credentials) => connectDatabase().then(() => seedAdminAccount(credentials)))
    .then(({ created }) => console.log(created ? 'Administrator account created.' : 'Administrator account already exists; no changes made.'))
    .catch((error) => {
      console.error('Administrator account provisioning failed:', error.message);
      process.exitCode = 1;
    })
    .finally(disconnectDatabase);
}
