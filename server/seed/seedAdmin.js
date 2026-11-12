import bcrypt from 'bcryptjs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import User from '../models/User.js';

function readAdminCredentials() {
  const email = process.env.DEMO_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.DEMO_ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('DEMO_ADMIN_EMAIL must be a valid email address.');
  }
  if (!password || password.length < 16) {
    throw new Error('DEMO_ADMIN_PASSWORD is required and must be at least 16 characters.');
  }
  return { email, password };
}

export async function seedAdminAccount() {
  const { email, password } = readAdminCredentials();
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
  connectDatabase()
    .then(seedAdminAccount)
    .then(({ created }) => console.log(created ? 'Administrator account created.' : 'Administrator account already exists; no changes made.'))
    .catch((error) => {
      console.error('Administrator account provisioning failed:', error.message);
      process.exitCode = 1;
    })
    .finally(disconnectDatabase);
}
