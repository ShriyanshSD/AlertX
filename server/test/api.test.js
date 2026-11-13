import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { io as createSocketClient } from 'socket.io-client';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-to-satisfy-validation';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/resq_phase2_test';
process.env.CORS_ORIGINS = 'http://127.0.0.1:5173';

const mongoose = (await import('mongoose')).default;
const { createApp } = await import('../app.js');
const { attachSocketServer } = await import('../sockets/index.js');
const { createDemoSimulator } = await import('../services/demoSimulator.js');
const { installVercelSocketRouting } = await import('../services/vercelSocketRouting.js');
const User = (await import('../models/User.js')).default;
const Vehicle = (await import('../models/Vehicle.js')).default;
const SOS = (await import('../models/SOS.js')).default;
const Contact = (await import('../models/Contact.js')).default;
const EmergencyAlert = (await import('../models/EmergencyAlert.js')).default;
const LocationHistory = (await import('../models/LocationHistory.js')).default;
const { createServerlessDemoSimulator } = await import('../services/serverlessDemoSimulator.js');
const { readAdminCredentials } = await import('../seed/seedAdmin.js');
const KnowledgeDocument = (await import('../models/KnowledgeDocument.js')).default;
const AIConversation = (await import('../models/AIConversation.js')).default;
const AIActivity = (await import('../models/AIActivity.js')).default;
const { toPoint, haversineDistanceKm } = await import('../utils/geo.js');

const suite = describe('ResQ API and real-time services', () => {
  let app;
  let server;
  let io;
  let simulator;
  let baseUrl;
  let testUser;
  let otherUser;
  let operator;
  let admin;
  let driver;
  let contact;
  let nearVehicle;
  let farVehicle;
  let realVehicle;
  let createdSosId;
  let userAgent;
  let otherAgent;
  let operatorAgent;
  let adminAgent;
  let driverAgent;
  const cookies = {};

  before(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.dropDatabase();
    const passwordHash = await bcrypt.hash('test-password-123', 4);
    [testUser, otherUser, operator, admin, driver] = await Promise.all([
      User.create({ name: 'Test User', email: 'user@test.local', passwordHash, role: 'user' }),
      User.create({ name: 'Other User', email: 'other@test.local', passwordHash, role: 'user' }),
      User.create({ name: 'Test Operator', email: 'operator@test.local', passwordHash, role: 'operator' }),
      User.create({ name: 'Test Admin', email: 'admin@test.local', passwordHash, role: 'admin' }),
      User.create({ name: 'Test Driver', email: 'driver@test.local', passwordHash, role: 'driver' }),
    ]);
    contact = await Contact.create({
      userId: testUser._id,
      contactCode: 'C-TEST',
      name: 'Test Contact',
      phone: '+91 90000 00000',
      relationship: 'Friend',
      location: toPoint({ lat: 28.671, lng: 77.455 }),
      notificationConsent: false,
    });
    [nearVehicle, farVehicle, realVehicle] = await Promise.all([
      Vehicle.create({
        vehicleId: 'AMB-NEAR',
        type: 'ambulance',
        status: 'available',
        currentLocation: toPoint({ lat: 28.6701, lng: 77.4524 }),
        isDemo: true,
        speed: 0,
      }),
      Vehicle.create({
        vehicleId: 'AMB-FAR',
        type: 'ambulance',
        status: 'offline',
        currentLocation: toPoint({ lat: 28.68, lng: 77.45 }),
        isDemo: true,
        speed: 0,
      }),
      Vehicle.create({
        vehicleId: 'AMB-REAL',
        type: 'ambulance',
        status: 'available',
        currentLocation: toPoint({ lat: 28.67, lng: 77.45 }),
        operatorId: driver._id,
        isDemo: false,
        speed: 0,
      }),
    ]);
    simulator = createDemoSimulator({ intervalMs: 200, historyIntervalMs: 200 });
    await KnowledgeDocument.create([
      {
        slug: 'test-minor-burns',
        title: 'Minor burn first aid',
        category: 'first_aid',
        content: 'Cool a minor burn under cool running water for 20 minutes. Do not apply ice.',
        keywords: ['burn', 'burns', 'first aid'],
        sourceTitle: 'NHS first aid guidance',
        sourceUrl: 'https://www.nhs.uk/conditions/first-aid/',
        lastReviewedAt: new Date(),
      },
      {
        slug: 'test-unconscious-first-aid',
        title: 'Emergency first aid for an unconscious person',
        category: 'first_aid',
        content: 'If someone is unconscious, contact local emergency services and follow the call handler instructions.',
        keywords: ['unconscious', 'unresponsive', 'emergency'],
        sourceTitle: 'Emergency first-aid guidance',
        sourceUrl: 'https://www.nhs.uk/conditions/first-aid/',
        lastReviewedAt: new Date(),
      },
      {
        slug: 'test-trusted-contacts',
        title: 'Manage trusted contacts in ResQ',
        category: 'platform',
        content: 'Open Trusted contacts from the menu to add, update, or remove your contacts.',
        keywords: ['trusted contact', 'contacts', 'platform'],
        sourceTitle: 'ResQ platform instructions',
        sourceUrl: '',
        lastReviewedAt: new Date(),
      },
    ]);
    app = createApp({ simulator, aiService: { generate: async () => null } });
    server = createServer(app);
    io = attachSocketServer(server, app);
    simulator.setIo(io);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    userAgent = request.agent(baseUrl);
    otherAgent = request.agent(baseUrl);
    operatorAgent = request.agent(baseUrl);
    adminAgent = request.agent(baseUrl);
    driverAgent = request.agent(baseUrl);
    for (const [name, agent, email] of [
      ['user', userAgent, 'user@test.local'],
      ['other', otherAgent, 'other@test.local'],
      ['operator', operatorAgent, 'operator@test.local'],
      ['admin', adminAgent, 'admin@test.local'],
      ['driver', driverAgent, 'driver@test.local'],
    ]) {
      const login = await agent.post('/api/auth/login').send({ email, password: 'test-password-123' });
      assert.equal(login.status, 200);
      assert.ok(login.headers['set-cookie'][0].includes('HttpOnly'));
      cookies[name] = login.headers['set-cookie'][0].split(';')[0];
    }
  });

  after(async () => {
    simulator?.stop();
    if (io) await new Promise((resolve) => io.close(resolve));
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('protects routes and never returns password hashes', async () => {
    const unauthorized = await request(baseUrl).get('/api/vehicles');
    assert.equal(unauthorized.status, 401);
    const anonymousSession = await request(baseUrl).get('/api/auth/session');
    assert.equal(anonymousSession.status, 200);
    assert.equal(anonymousSession.body.data.user, null);

    const registration = await request(baseUrl).post('/api/auth/register').send({
      name: 'New Account',
      email: 'new@test.local',
      password: 'another-test-password',
      role: 'admin',
    });

    it('changes passwords only after verifying the current password', async () => {
      const invalid = await userAgent.patch('/api/auth/password').send({
        currentPassword: 'wrong-password',
        newPassword: 'updated-test-password',
      });
      assert.equal(invalid.status, 400);

      const changed = await userAgent.patch('/api/auth/password').send({
        currentPassword: 'test-password-123',
        newPassword: 'updated-test-password',
      });
      assert.equal(changed.status, 200);
      assert.equal(changed.body.data.passwordUpdated, true);
      assert.equal('passwordHash' in changed.body.data, false);

      const oldPasswordLogin = await request(baseUrl).post('/api/auth/login').send({
        email: 'user@test.local',
        password: 'test-password-123',
      });
      assert.equal(oldPasswordLogin.status, 401);
      const newPasswordLogin = await request(baseUrl).post('/api/auth/login').send({
        email: 'user@test.local',
        password: 'updated-test-password',
      });
      assert.equal(newPasswordLogin.status, 200);
    });
    assert.equal(registration.status, 201);
    assert.equal(registration.body.data.user.role, 'user');
    assert.equal('passwordHash' in registration.body.data.user, false);
    assert.equal(registration.headers['set-cookie'][0].includes('HttpOnly'), true);

    const adminOnly = await userAgent.get('/api/admin/users');
    assert.equal(adminOnly.status, 403);
    const userResponse = await adminAgent.get('/api/admin/users');
    assert.equal(userResponse.status, 200);
    assert.equal(userResponse.body.data.users.some((user) => 'passwordHash' in user), false);
  });

  it('lets admins create and manage accounts while preventing privilege and self-delete errors', async () => {
    const weakPassword = await adminAgent.post('/api/admin/users').send({
      name: 'Short Password',
      email: 'short-password@test.local',
      password: 'short',
      role: 'user',
    });
    assert.equal(weakPassword.status, 400);

    const created = await adminAgent.post('/api/admin/users').send({
      name: 'Managed Account',
      email: 'managed-account@test.local',
      password: 'A-long-test-password-123!',
      role: 'driver',
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.user.role, 'driver');
    assert.equal('passwordHash' in created.body.data.user, false);

    const forbiddenUpdate = await userAgent.patch(`/api/admin/users/${created.body.data.user.id}`).send({ role: 'admin' });
    assert.equal(forbiddenUpdate.status, 403);

    const changed = await adminAgent.patch(`/api/admin/users/${created.body.data.user.id}`).send({
      name: 'Updated Managed Account',
      phone: '+91 90000 00001',
      role: 'operator',
    });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.data.user.name, 'Updated Managed Account');
    assert.equal(changed.body.data.user.role, 'operator');

    const rejectedSecret = await adminAgent.patch(`/api/admin/users/${created.body.data.user.id}`).send({
      passwordHash: 'never-accepted',
    });
    assert.equal(rejectedSecret.status, 400);

    const selfDelete = await adminAgent.delete(`/api/admin/users/${admin._id}`);
    assert.equal(selfDelete.status, 409);

    const removed = await adminAgent.delete(`/api/admin/users/${created.body.data.user.id}`);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.data.deleted, true);
  });

  it('allows short bootstrap passwords only for localhost development databases', () => {
    const localCredentials = {
      NODE_ENV: 'development',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/resq_local_demo',
      DEMO_ADMIN_EMAIL: 'admin@gmail.com',
      DEMO_ADMIN_PASSWORD: 'demo-pass',
    };
    assert.equal(readAdminCredentials(localCredentials).email, 'admin@gmail.com');
    assert.throws(
      () => readAdminCredentials({ ...localCredentials, MONGODB_URI: 'mongodb+srv://cluster.example/resq' }),
      /at least 16 characters/,
    );
    assert.throws(
      () => readAdminCredentials({ ...localCredentials, NODE_ENV: 'production' }),
      /at least 16 characters/,
    );
  });

  it('protects active SOS requests and removes owned data when deleting an account', async () => {
    const managedUser = await User.create({
      name: 'Data Removal Driver',
      email: 'data-removal-driver@test.local',
      passwordHash: await bcrypt.hash('test-password-123', 4),
      role: 'driver',
    });
    const ownedContact = await Contact.create({
      userId: managedUser._id,
      contactCode: 'C-DELETE-TEST',
      name: 'Delete Test Contact',
      phone: '+91 90000 00000',
      relationship: 'Friend',
    });
    const ownedSos = await SOS.create({
      sosId: 'SOS-DELETE-TEST',
      userId: managedUser._id,
      emergencyType: 'medical',
      priority: 'critical',
      location: toPoint({ lat: 28.671, lng: 77.455 }),
      status: 'resolved',
      resolvedAt: new Date(),
      alertContacts: [{ contactId: ownedContact._id, status: 'in_app_created' }],
    });
    const activeSos = await SOS.create({
      sosId: 'SOS-ACTIVE-DELETE-TEST',
      userId: managedUser._id,
      emergencyType: 'medical',
      priority: 'high',
      location: toPoint({ lat: 28.671, lng: 77.455 }),
      status: 'pending',
    });
    const assignedVehicle = await Vehicle.create({
      vehicleId: 'AMB-DELETE-TEST',
      type: 'ambulance',
      status: 'available',
      driverName: 'Data Removal Driver',
      operatorId: managedUser._id,
      assignedSOS: ownedSos._id,
      currentLocation: toPoint({ lat: 28.671, lng: 77.455 }),
      isDemo: false,
      speed: 0,
    });
    ownedSos.assignedVehicle = assignedVehicle._id;
    await ownedSos.save();
    const activeAssignedSos = await SOS.create({
      sosId: 'SOS-DRIVER-ACTIVE-DELETE-TEST',
      userId: otherUser._id,
      emergencyType: 'medical',
      priority: 'high',
      location: toPoint({ lat: 28.672, lng: 77.456 }),
      status: 'responding',
      assignedVehicle: assignedVehicle._id,
      alertContacts: [{ contactId: ownedContact._id, status: 'in_app_created' }],
    });
    assignedVehicle.assignedSOS = activeAssignedSos._id;
    await assignedVehicle.save();
    const externalSos = await SOS.create({
      sosId: 'SOS-EXTERNAL-CONTACT-TEST',
      userId: otherUser._id,
      emergencyType: 'medical',
      priority: 'medium',
      location: toPoint({ lat: 28.672, lng: 77.456 }),
      status: 'resolved',
      alertContacts: [{ contactId: ownedContact._id, status: 'consent_required' }],
    });
    await Promise.all([
      EmergencyAlert.create({
        sosId: ownedSos._id,
        contactId: ownedContact._id,
        recipientUserId: managedUser._id,
        status: 'created',
      }),
      AIConversation.create({ userId: managedUser._id, messages: [{ role: 'user', content: 'Test message' }] }),
      AIActivity.create({ userId: managedUser._id, provider: 'knowledge_base' }),
    ]);

    const blocked = await adminAgent.delete(`/api/admin/users/${managedUser._id}`);
    assert.equal(blocked.status, 409);
    assert.ok(await User.exists({ _id: managedUser._id }));

    await SOS.updateOne({ _id: activeSos._id }, { $set: { status: 'resolved', resolvedAt: new Date() } });
    const blockedDriverRemoval = await adminAgent.delete(`/api/admin/users/${managedUser._id}`);
    assert.equal(blockedDriverRemoval.status, 409);
    const blockedDriverDemotion = await adminAgent.patch(`/api/admin/users/${managedUser._id}`).send({ role: 'user' });
    assert.equal(blockedDriverDemotion.status, 409);

    await SOS.updateOne({ _id: activeAssignedSos._id }, { $set: { status: 'resolved', resolvedAt: new Date() } });
    const removed = await adminAgent.delete(`/api/admin/users/${managedUser._id}`);
    assert.equal(removed.status, 200);

    const [remainingContacts, remainingSos, remainingAlerts, remainingConversation, remainingActivity, updatedVehicle, preservedSos] = await Promise.all([
      Contact.countDocuments({ userId: managedUser._id }),
      SOS.countDocuments({ userId: managedUser._id }),
      EmergencyAlert.countDocuments({ recipientUserId: managedUser._id }),
      AIConversation.countDocuments({ userId: managedUser._id }),
      AIActivity.countDocuments({ userId: managedUser._id }),
      Vehicle.findById(assignedVehicle._id).lean(),
      SOS.findById(externalSos._id).lean(),
    ]);
    assert.equal(remainingContacts, 0);
    assert.equal(remainingSos, 0);
    assert.equal(remainingAlerts, 0);
    assert.equal(remainingConversation, 0);
    assert.equal(remainingActivity, 0);
    assert.equal(updatedVehicle.operatorId, null);
    assert.equal(updatedVehicle.assignedSOS, null);
    assert.equal(updatedVehicle.driverName, 'Unassigned');
    assert.equal(preservedSos.alertContacts.length, 0);
  });

  it('lets authorized dispatchers edit a fleet unit service type and crew label', async () => {
    const created = await adminAgent.post('/api/vehicles').send({
      vehicleId: 'AMB-EDIT-TEST',
      type: 'ambulance',
      driverName: 'Initial Crew',
      location: { lat: 28.671, lng: 77.455 },
    });
    assert.equal(created.status, 201);

    const forbidden = await userAgent.patch('/api/vehicles/AMB-EDIT-TEST').send({ type: 'fire_truck' });
    assert.equal(forbidden.status, 403);

    const invalid = await adminAgent.patch('/api/vehicles/AMB-EDIT-TEST').send({ type: 'tow_truck' });
    assert.equal(invalid.status, 400);

    const changed = await adminAgent.patch('/api/vehicles/AMB-EDIT-TEST').send({
      type: 'fire_truck',
      driverName: 'Updated Crew',
    });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.data.vehicle.type, 'fire_truck');
    assert.equal(changed.body.data.vehicle.driverName, 'Updated Crew');

    const removed = await adminAgent.delete('/api/vehicles/AMB-EDIT-TEST');
    assert.equal(removed.status, 200);
  });

  it('limits fleet visibility and ranks nearby vehicles by straight-line distance', async () => {
    const visibleToUser = await userAgent.get('/api/vehicles');
    assert.equal(visibleToUser.status, 200);
    const visibleVehicleIds = visibleToUser.body.data.vehicles.map((vehicle) => vehicle.vehicleId);
    assert.ok(visibleVehicleIds.includes('AMB-NEAR'));
    assert.ok(visibleVehicleIds.includes('AMB-REAL'));
    assert.equal(visibleVehicleIds.includes('AMB-FAR'), false);

    const nearby = await operatorAgent.get('/api/vehicles/nearby?lat=28.6702&lng=77.4524&radiusKm=10&type=ambulance');
    assert.equal(nearby.status, 200);
    assert.equal(nearby.body.data.vehicles[0].vehicleId, 'AMB-NEAR');
    assert.ok(nearby.body.data.vehicles[0].distanceKm < 1);
    assert.equal(haversineDistanceKm(toPoint({ lat: 0, lng: 0 }), toPoint({ lat: 0, lng: 1 })) > 100, true);

    const forbiddenNearby = await userAgent.get('/api/vehicles/nearby?lat=28.6702&lng=77.4524');
    assert.equal(forbiddenNearby.status, 403);
  });

  it('requires a beneficiary name when an SOS is for someone else', async () => {
    const response = await userAgent.post('/api/sos').send({
      emergencyType: 'medical',
      location: { lat: 28.6702, lng: 77.4524 },
      reportedFor: 'other',
      personName: ' ',
    });
    assert.equal(response.status, 400);
    assert.ok(response.body.error.details.body.some((issue) => (
      issue.path === 'personName' && /person who needs help/i.test(issue.message)
    )));
  });

  it('creates an SOS, assigns the nearest eligible vehicle, and records consent-aware alerts', async () => {
    const response = await userAgent.post('/api/sos').send({
      emergencyType: 'medical',
      location: { lat: 28.6752, lng: 77.4624 },
      locationLabel: 'North entrance, sample clinic',
      reportedFor: 'other',
      personName: 'Jordan Friend',
      personRelationship: 'Friend',
      alertContactIds: [String(contact._id)],
    });

    it('keeps unspecified emergency requests pending without an automatic vehicle assignment', async () => {
      const response = await userAgent.post('/api/sos').send({
        emergencyType: 'other',
        description: 'Unspecified incident requiring dispatcher review.',
        location: { lat: 28.6702, lng: 77.4524 },
      });
      assert.equal(response.status, 201);
      assert.equal(response.body.data.sos.emergencyType, 'other');
      assert.equal(response.body.data.sos.priority, 'medium');
      assert.equal(response.body.data.sos.status, 'Pending');
      assert.equal(response.body.data.sos.reportedFor, 'self');
      assert.equal(response.body.data.sos.personName, '');
      assert.equal(response.body.data.sos.assignedVehicle, null);
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.data.sos.priority, 'critical');
    assert.equal(response.body.data.sos.assignedVehicle, 'AMB-NEAR');
    assert.equal(response.body.data.sos.status, 'Assigned');
    assert.equal(response.body.data.sos.reportedFor, 'other');
    assert.equal(response.body.data.sos.personName, 'Jordan Friend');
    assert.equal(response.body.data.sos.personRelationship, 'Friend');
    assert.equal(response.body.data.sos.location, 'North entrance, sample clinic');
    assert.equal(response.body.data.sos.lat, 28.6752);
    assert.equal(response.body.data.sos.lng, 77.4624);
    const storedSos = await SOS.findOne({ sosId: response.body.data.sos.sosId });
    assert.equal(storedSos.reportedFor, 'other');
    assert.equal(storedSos.personName, 'Jordan Friend');
    assert.equal(storedSos.locationLabel, 'North entrance, sample clinic');
    assert.equal(response.body.data.sos.alertContacts[0].status, 'consent_required');
    createdSosId = response.body.data.sos.sosId;
    const userFleet = await userAgent.get('/api/vehicles');
    assert.ok(userFleet.body.data.vehicles.some((vehicle) => vehicle.vehicleId === 'AMB-NEAR'));

    const [assigned, alert, forbidden] = await Promise.all([
      Vehicle.findById(nearVehicle._id),
      EmergencyAlert.findOne({ contactId: contact._id }),
      otherAgent.get(`/api/sos/${response.body.data.sos.sosId}`),
    ]);
    assert.equal(assigned.status, 'en_route');
    assert.equal(assigned.assignedSOS.toString(), (await SOS.findOne({ sosId: response.body.data.sos.sosId }))._id.toString());
    assert.equal(alert.status, 'consent_required');
    assert.equal(forbidden.status, 404);
  });

  it('keeps assigned-unit history after resolution while limiting user fleet visibility', async () => {
    const responding = await adminAgent.patch(`/api/sos/${createdSosId}/status`).send({ status: 'responding' });
    assert.equal(responding.status, 200);
    const resolved = await adminAgent.patch(`/api/sos/${createdSosId}/status`).send({ status: 'resolved' });
    assert.equal(resolved.status, 200);
    assert.equal(resolved.body.data.sos.assignedVehicle, 'AMB-NEAR');
    assert.equal((await Vehicle.findById(nearVehicle._id)).assignedSOS, null);
    const userFleet = await userAgent.get('/api/vehicles');
    const visibleVehicleIds = userFleet.body.data.vehicles.map((vehicle) => vehicle.vehicleId);
    assert.ok(visibleVehicleIds.includes('AMB-NEAR'));
    assert.ok(visibleVehicleIds.includes('AMB-REAL'));
    assert.equal(visibleVehicleIds.includes('AMB-FAR'), false);
  });

  it('supports private contact CRUD and explicit notification consent', async () => {
    const created = await userAgent.post('/api/contacts').send({
      name: 'Second Contact',
      phone: '+91 91111 11111',
      relationship: 'Family',
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.contact.notificationConsent, false);
    assert.equal(created.body.data.contact.lat, undefined);

    const updated = await userAgent.patch(`/api/contacts/${created.body.data.contact.contactId}`).send({
      notificationConsent: true,
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.contact.notificationConsent, true);
    const privateContact = await otherAgent.get('/api/contacts');
    assert.equal(privateContact.body.data.contacts.length, 0);

    const deleted = await userAgent.delete(`/api/contacts/${created.body.data.contact.contactId}`);
    assert.equal(deleted.status, 200);
  });

  it('serves cited RAG answers with private, opt-in conversation history', async () => {
    const unauthorized = await request(baseUrl).post('/api/ai/chat').send({ message: 'How do burns work?' });
    assert.equal(unauthorized.status, 401);

    const invalid = await userAgent.post('/api/ai/chat').send({ message: '   ' });
    assert.equal(invalid.status, 400);

    const greeting = await userAgent.post('/api/ai/chat').send({ message: 'Hi!' });
    assert.equal(greeting.status, 200);
    assert.equal(greeting.body.data.provider, 'greeting');
    assert.match(greeting.body.data.answer, /^Hi! I'm ResQ AI Assistant/);
    assert.deepEqual(greeting.body.data.citations, []);

    const response = await userAgent.post('/api/ai/chat').send({
      message: 'What should I do for a burn?',
      saveHistory: true,
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.provider, 'knowledge_base');
    assert.match(response.body.data.answer, /cool running water for 20 minutes/);
    assert.equal(response.body.data.citations[0].title, 'Minor burn first aid');
    assert.equal(response.body.data.messages.length, 2);

    const [ownConversation, otherConversation, adminConversation] = await Promise.all([
      userAgent.get('/api/ai/conversation'),
      otherAgent.get('/api/ai/conversation'),
      adminAgent.get('/api/ai/conversation'),
    ]);
    assert.equal(ownConversation.body.data.messages.length, 2);
    assert.deepEqual(otherConversation.body.data.messages, []);
    assert.deepEqual(adminConversation.body.data.messages, []);

    const unsaved = await userAgent.post('/api/ai/chat').send({
      message: 'How can I manage trusted contacts in ResQ?',
    });
    assert.equal(unsaved.body.data.messages, null);
    assert.equal((await userAgent.get('/api/ai/conversation')).body.data.messages.length, 2);

    const cleared = await userAgent.delete('/api/ai/conversation');
    assert.equal(cleared.body.data.cleared, true);
    assert.deepEqual((await userAgent.get('/api/ai/conversation')).body.data.messages, []);
    assert.equal(await AIActivity.countDocuments({ userId: testUser._id }), 0);
    assert.equal(await AIConversation.countDocuments({ userId: testUser._id }), 0);

    await userAgent.post('/api/ai/chat').send({ message: 'How can I manage trusted contacts in ResQ?' });
    assert.equal(await AIActivity.countDocuments({ userId: testUser._id }), 1);
    assert.equal(await AIConversation.countDocuments({ userId: testUser._id }), 0);
    await userAgent.delete('/api/ai/conversation');
    assert.equal(await AIActivity.countDocuments({ userId: testUser._id }), 0);
  });

  it('flags emergency questions, cites available guidance, and safely handles missing knowledge and Gemini', async () => {
    const emergency = await userAgent.post('/api/ai/chat').send({ message: 'Hi, someone is unconscious.' });
    assert.equal(emergency.status, 200);
    assert.equal(emergency.body.data.emergency.detected, true);
    assert.equal(emergency.body.data.emergency.offerSos, true);
    assert.match(emergency.body.data.answer, /call local emergency services now/i);
    assert.equal(emergency.body.data.citations[0].title, 'Emergency first aid for an unconscious person');

    const unknown = await userAgent.post('/api/ai/chat').send({ message: 'What is the best telescope for astronomy?' });
    assert.match(unknown.body.data.answer, /could not find a matching ResQ knowledge-base source/i);
    assert.equal(unknown.body.data.provider, 'knowledge_base');
    assert.deepEqual(unknown.body.data.citations, []);

    const originalService = app.get('geminiService');
    let retrievedDocumentCount = -1;
    app.set('geminiService', {
      generate: async ({ documents }) => {
        retrievedDocumentCount = documents.length;
        return 'Saturn has an extensive ring system.';
      },
    });
    try {
      const general = await userAgent.post('/api/ai/chat').send({ message: 'Tell me a fun fact about Saturn.' });
      assert.equal(general.status, 200);
      assert.equal(general.body.data.provider, 'gemini');
      assert.equal(general.body.data.answer, 'Saturn has an extensive ring system.');
      assert.equal(general.body.data.confidence, 0);
      assert.equal(retrievedDocumentCount, 0);
      assert.deepEqual(general.body.data.citations, []);
    } finally {
      app.set('geminiService', originalService);
    }

    app.set('geminiService', {
      generate: async () => { throw Object.assign(new Error('simulated provider outage'), { code: 'QUOTA' }); },
    });
    try {
      const fallback = await userAgent.post('/api/ai/chat').send({
        message: 'How can I manage trusted contacts in ResQ?',
      });
      assert.equal(fallback.body.data.provider, 'knowledge_base');
      assert.match(fallback.body.data.warning, /quota or rate limits/i);
      assert.doesNotMatch(fallback.body.data.warning, /simulated provider outage/);
      assert.equal(fallback.body.data.citations[0].title, 'Manage trusted contacts in ResQ');
    } finally {
      app.set('geminiService', originalService);
    }
  });

  it('enforces dispatch permissions and updates authorized driver locations', async () => {
    const deniedStatus = await userAgent.patch('/api/vehicles/AMB-FAR/status').send({ status: 'offline' });
    assert.equal(deniedStatus.status, 403);
    const statusUpdate = await operatorAgent.patch('/api/vehicles/AMB-FAR/status').send({ status: 'offline' });
    assert.equal(statusUpdate.status, 200);
    assert.equal(statusUpdate.body.data.vehicle.status, 'offline');

    const driverUpdate = await driverAgent.post('/api/vehicles/AMB-REAL/location').send({
      location: { lat: 28.672, lng: 77.456 },
      speed: 25,
    });
    assert.equal(driverUpdate.status, 200);
    assert.equal((await Vehicle.findById(realVehicle._id)).currentLocation.coordinates[0], 77.456);
    assert.equal(await LocationHistory.countDocuments({ vehicleId: realVehicle._id, isDemo: false }), 1);

    const wrongVehicle = await driverAgent.post('/api/vehicles/AMB-NEAR/location').send({
      location: { lat: 28.672, lng: 77.456 },
      speed: 25,
    });
    assert.equal(wrongVehicle.status, 403);
  });

  it('serves admin analytics and moves demo vehicles within bounds', async () => {
    const dashboard = await adminAgent.get('/api/admin/dashboard');
    const analytics = await adminAgent.get('/api/admin/analytics');
    const filteredAnalytics = await adminAgent.get('/api/admin/analytics?type=medical&priority=critical&status=resolved');
    assert.equal(dashboard.status, 200);
    assert.equal(analytics.status, 200);
    assert.equal(filteredAnalytics.status, 200);
    assert.equal(filteredAnalytics.body.data.sosCount, 1);
    assert.deepEqual(filteredAnalytics.body.data.byPriority, [{ _id: 'critical', count: 1 }]);
    assert.deepEqual(filteredAnalytics.body.data.byStatus, [{ _id: 'resolved', count: 1 }]);
    assert.ok(analytics.body.data.aiActivity.requests >= 3);
    assert.ok(dashboard.body.data.totals.vehicles >= 3);

    await Vehicle.findByIdAndUpdate(farVehicle._id, {
      $set: { status: 'en_route', speed: 40, heading: 90 },
    });
    const before = (await Vehicle.findById(farVehicle._id)).currentLocation.coordinates;
    simulator.start();
    await new Promise((resolve) => setTimeout(resolve, 350));
    simulator.stop();
    const moved = await Vehicle.findById(farVehicle._id);
    assert.notDeepEqual(moved.currentLocation.coordinates, before);
    assert.equal(moved.isDemo, true);
    assert.ok(moved.currentLocation.coordinates[0] >= 77.438 && moved.currentLocation.coordinates[0] <= 77.469);
    assert.ok(moved.currentLocation.coordinates[1] >= 28.658 && moved.currentLocation.coordinates[1] <= 28.684);
    assert.ok(await LocationHistory.exists({ vehicleId: farVehicle._id, isDemo: true }));
  });

  it('shares serverless simulator control state through MongoDB', async () => {
    const firstInstance = createServerlessDemoSimulator({ intervalMs: 2000 });
    const secondInstance = createServerlessDemoSimulator({ intervalMs: 2000 });
    await secondInstance.stop();

    assert.equal((await firstInstance.start()).running, true);
    assert.equal((await secondInstance.getState()).running, true);
    assert.equal((await secondInstance.stop()).running, false);
    assert.equal((await firstInstance.getState()).running, false);
  });

  it('serves rewritten Vercel API paths through the shared function route', async () => {
    const vercelApp = createApp({ simulator, requestPathPrefix: '/api/server' });
    const response = await request(vercelApp)
      .get('/api/server?__vercel_path=%2Fapi%2Fhealth&probe=preserved');
    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, 'ok');
  });

  it('routes rewritten Vercel Socket.IO traffic before Express handles it', async () => {
    const vercelApp = createApp({ simulator, requestPathPrefix: '/api/server' });
    const vercelServer = createServer();
    const socketPath = '/api/server/socket.io';
    const vercelIo = attachSocketServer(vercelServer, vercelApp, {
      path: socketPath,
      addTrailingSlash: false,
    });
    installVercelSocketRouting(vercelServer, vercelApp, vercelIo, socketPath);
    await new Promise((resolve) => vercelServer.listen(0, '127.0.0.1', resolve));

    const client = createSocketClient(`http://127.0.0.1:${vercelServer.address().port}`, {
      path: '/api/server',
      addTrailingSlash: false,
      query: { __vercel_path: socketPath },
      transports: ['websocket'],
      extraHeaders: { Cookie: cookies.admin },
      reconnection: false,
    });
    try {
      await new Promise((resolve, reject) => {
        client.once('connect', resolve);
        client.once('connect_error', reject);
      });
      const joined = await new Promise((resolve) => {
        client.emit('joinTrackingRoom', { type: 'admin' }, resolve);
      });
      assert.deepEqual(joined, { ok: true });

      const health = await request(vercelServer)
        .get('/api/server?__vercel_path=%2Fapi%2Fhealth');
      assert.equal(health.status, 200);
      assert.equal(health.body.data.status, 'ok');
    } finally {
      client.disconnect();
      await new Promise((resolve) => vercelIo.close(resolve));
      if (vercelServer.listening) await new Promise((resolve) => vercelServer.close(resolve));
    }
  });

  it('moves demo vehicles for connected serverless clients and records demo history', async () => {
    const serverlessSimulator = createServerlessDemoSimulator({
      intervalMs: 200,
      historyIntervalMs: 200,
    });
    serverlessSimulator.setIo(io);
    await serverlessSimulator.stop();
    await Vehicle.findByIdAndUpdate(farVehicle._id, {
      $set: { status: 'en_route', speed: 40, heading: 90 },
    });
    const before = (await Vehicle.findById(farVehicle._id)).currentLocation.coordinates;
    const client = createSocketClient(baseUrl, {
      transports: ['websocket'],
      extraHeaders: { Cookie: cookies.admin },
      reconnection: false,
    });
    try {
      await new Promise((resolve, reject) => {
        client.once('connect', resolve);
        client.once('connect_error', reject);
      });
      const joined = await new Promise((resolve) => {
        client.emit('joinTrackingRoom', { type: 'admin' }, resolve);
      });
      assert.deepEqual(joined, { ok: true });

      const locationUpdate = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Serverless demo GPS update was not broadcast.')), 1500);
        client.once('vehicleLocationUpdated', (event) => {
          clearTimeout(timer);
          resolve(event);
        });
      });
      await serverlessSimulator.start();
      const event = await locationUpdate;
      assert.equal(event.vehicle.vehicleId, 'AMB-FAR');
      assert.equal(event.isDemo, true);
      assert.notDeepEqual(
        (await Vehicle.findById(farVehicle._id)).currentLocation.coordinates,
        before,
      );
      assert.ok(await LocationHistory.exists({ vehicleId: farVehicle._id, isDemo: true }));
    } finally {
      await serverlessSimulator.stop();
      client.disconnect();
    }
  });

  it('authenticates sockets and rejects unauthorized tracking rooms and demo GPS writes', async () => {
    const client = createSocketClient(baseUrl, {
      transports: ['websocket'],
      extraHeaders: { Cookie: cookies.admin },
      reconnection: false,
    });
    try {
      await new Promise((resolve, reject) => {
        client.once('connect', resolve);
        client.once('connect_error', reject);
      });
      const adminRoom = await new Promise((resolve) => client.emit('joinTrackingRoom', { type: 'admin' }, resolve));
      assert.deepEqual(adminRoom, { ok: true });

      await Vehicle.findByIdAndUpdate(farVehicle._id, {
        $set: { status: 'en_route', speed: 40, heading: 90 },
      });
      const locationUpdate = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Demo GPS update was not broadcast.')), 1500);
        client.once('vehicleLocationUpdated', (event) => {
          clearTimeout(timer);
          resolve(event);
        });
      });
      simulator.start();
      let locationEvent;
      try {
        locationEvent = await locationUpdate;
      } finally {
        simulator.stop();
      }
      assert.equal(locationEvent.vehicle.vehicleId, 'AMB-FAR');
      assert.equal(locationEvent.isDemo, true);

      const untrustedClient = createSocketClient(baseUrl, {
        transports: ['websocket'],
        extraHeaders: { Cookie: cookies.user },
        reconnection: false,
      });
      try {
        await new Promise((resolve, reject) => {
          untrustedClient.once('connect', resolve);
          untrustedClient.once('connect_error', reject);
        });
        const denied = await new Promise((resolve) => untrustedClient.emit('joinTrackingRoom', { type: 'admin' }, resolve));
        assert.match(denied.error, /Admin access/);
        const deniedLocation = await new Promise((resolve) => untrustedClient.emit('vehicleLocationUpdate', {
          vehicleId: 'AMB-NEAR',
          location: { lat: 28.672, lng: 77.456 },
          speed: 10,
        }, resolve));
        assert.match(deniedLocation.error, /driver devices/);

        const notification = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Emergency notification was not delivered.')), 1500);
          untrustedClient.once('emergencyNotification', (event) => {
            clearTimeout(timer);
            resolve(event);
          });
        });
        const adminSosCreated = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Admin SOS notification was not delivered.')), 1500);
          client.once('sosCreated', (event) => {
            clearTimeout(timer);
            resolve(event);
          });
        });
        const fleetChanged = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Fleet update was not broadcast to user dashboards.')), 1500);
          untrustedClient.once('fleetUpdated', () => {
            clearTimeout(timer);
            resolve();
          });
        });
        const createdVehicle = await adminAgent.post('/api/vehicles').send({
          vehicleId: 'AMB-LIVE-TEST',
          type: 'ambulance',
          location: { lat: 28.671, lng: 77.455 },
        });
        assert.equal(createdVehicle.status, 201);
        await fleetChanged;
        const userFleet = await userAgent.get('/api/vehicles');
        assert.ok(userFleet.body.data.vehicles.some((vehicle) => vehicle.vehicleId === 'AMB-LIVE-TEST'));
        await adminAgent.delete('/api/vehicles/AMB-LIVE-TEST');

        const created = await userAgent.post('/api/sos').send({
          emergencyType: 'medical',
          location: { lat: 28.6702, lng: 77.4524 },
          locationLabel: 'Manual map pin',
          reportedFor: 'other',
          personName: 'Socket Test Relative',
          personRelationship: 'Sibling',
          alertContactIds: [String(contact._id)],
        });
        assert.equal(created.status, 201);
        const event = await notification;
        assert.equal(event.status, 'consent_required');
        const adminEvent = await adminSosCreated;
        assert.equal(adminEvent.sosId, created.body.data.sos.sosId);
        assert.equal(adminEvent.personName, 'Socket Test Relative');
        assert.equal(adminEvent.location, 'Manual map pin');

        const statusChange = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Vehicle status notification was not delivered.')), 1500);
          client.once('vehicleStatusChanged', (payload) => {
            clearTimeout(timer);
            resolve(payload);
          });
        });
        const resolvedEvent = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('SOS resolution notification was not delivered.')), 1500);
          client.once('sosResolved', (payload) => {
            clearTimeout(timer);
            resolve(payload);
          });
        });
        const resolvedResponse = await adminAgent.patch(`/api/sos/${created.body.data.sos.sosId}/status`).send({ status: 'resolved' });
        assert.equal(resolvedResponse.status, 200);
        assert.equal((await statusChange).vehicle.status, 'available');
        assert.equal((await resolvedEvent).status.toLowerCase(), 'resolved');
      } finally {
        untrustedClient.disconnect();
      }
    } finally {
      client.disconnect();
    }
  });
});
