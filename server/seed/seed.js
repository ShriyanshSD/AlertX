import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import Contact from '../models/Contact.js';
import SOS from '../models/SOS.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import { DEMO_CONTACTS, DEMO_SOS, DEMO_VEHICLES } from '../data/demoData.js';
import { toPoint } from '../utils/geo.js';
import { seedKnowledgeBase } from './seedKnowledge.js';

async function requiredCredential(emailKey, passwordKey, minimumPasswordLength = 12) {
  const email = process.env[emailKey]?.trim().toLowerCase();
  const password = process.env[passwordKey];
  if (!email || !password || password.length < minimumPasswordLength) {
    throw new Error(`${emailKey} and ${passwordKey} are required; passwords must be at least ${minimumPasswordLength} characters.`);
  }
  return { email, password };
}

async function upsertUser({ email, password, name, role }) {
  const passwordHash = await bcrypt.hash(password, 12);
  return User.findOneAndUpdate(
    { email },
    { $set: { email, name, passwordHash, role, phone: '' } },
    { returnDocument: 'after', upsert: true, runValidators: true },
  );
}

export async function seedDatabase() {
  const [adminCredentials, operatorCredentials, driverCredentials, userCredentials] = await Promise.all([
    requiredCredential('DEMO_ADMIN_EMAIL', 'DEMO_ADMIN_PASSWORD', 16),
    requiredCredential('DEMO_OPERATOR_EMAIL', 'DEMO_OPERATOR_PASSWORD'),
    requiredCredential('DEMO_DRIVER_EMAIL', 'DEMO_DRIVER_PASSWORD'),
    requiredCredential('DEMO_USER_EMAIL', 'DEMO_USER_PASSWORD'),
  ]);
  const [admin, operator, driver, demoUser] = await Promise.all([
    upsertUser({ ...adminCredentials, name: 'ResQ Demo Admin', role: 'admin' }),
    upsertUser({ ...operatorCredentials, name: 'ResQ Demo Operator', role: 'operator' }),
    upsertUser({ ...driverCredentials, name: 'ResQ Demo Driver', role: 'driver' }),
    upsertUser({ ...userCredentials, name: 'ResQ Demo User', role: 'user' }),
  ]);

  const vehicleRecords = await Promise.all(DEMO_VEHICLES.map((vehicle) => Vehicle.findOneAndUpdate(
    { vehicleId: vehicle.vehicleId },
    {
      $set: {
        type: vehicle.type,
        driverName: vehicle.driverName,
        operatorId: driver._id,
        status: vehicle.status,
        currentLocation: toPoint({ lat: vehicle.lat, lng: vehicle.lng }),
        speed: vehicle.speed,
        heading: vehicle.heading,
        isDemo: true,
        lastUpdated: new Date(),
      },
    },
    { returnDocument: 'after', upsert: true, runValidators: true },
  )));
  const vehiclesById = new Map(vehicleRecords.map((vehicle) => [vehicle.vehicleId, vehicle]));

  await Promise.all(DEMO_CONTACTS.map((contact) => Contact.findOneAndUpdate(
    { contactCode: contact.contactCode },
    {
      $set: {
        userId: demoUser._id,
        name: contact.name,
        phone: contact.phone,
        relationship: contact.relationship,
        location: toPoint({ lat: contact.lat, lng: contact.lng }),
        notificationConsent: false,
        isActive: true,
      },
    },
    { returnDocument: 'after', upsert: true, runValidators: true },
  )));

  const sosRecords = await Promise.all(DEMO_SOS.map(async (record) => {
    const assignedVehicle = record.vehicleId ? vehiclesById.get(record.vehicleId) : null;
    return SOS.findOneAndUpdate(
      { sosId: record.sosId },
      {
        $set: {
          userId: demoUser._id,
          emergencyType: record.emergencyType,
          priority: record.priority,
          status: record.status,
          location: toPoint(record.location),
          locationLabel: record.locationLabel,
          assignedVehicle: assignedVehicle?._id || null,
          description: '',
          isDemo: true,
          createdAt: new Date(record.createdAt),
        },
      },
      { returnDocument: 'after', upsert: true, runValidators: true },
    );
  }));
  const sosByCode = new Map(sosRecords.map((sos) => [sos.sosId, sos]));
  await Promise.all([
    Vehicle.updateOne({ vehicleId: 'AMB-101' }, { $set: { assignedSOS: sosByCode.get('SOS-001')._id } }),
    Vehicle.updateOne({ vehicleId: 'FIRE-201' }, { $set: { assignedSOS: sosByCode.get('SOS-002')._id } }),
    Vehicle.updateOne({ vehicleId: 'AMB-102' }, { $set: { assignedSOS: null } }),
    Vehicle.updateOne({ vehicleId: 'POL-301' }, { $set: { assignedSOS: null } }),
    Vehicle.updateOne({ vehicleId: 'POL-302' }, { $set: { assignedSOS: null } }),
  ]);
  await seedKnowledgeBase();
  return { admin, operator, driver, demoUser };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  connectDatabase()
    .then(seedDatabase)
    .then(() => console.log('ResQ demo data seeded.'))
    .catch((error) => {
      console.error('ResQ demo data seeding failed.', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await disconnectDatabase();
      await mongoose.disconnect();
    });
}
