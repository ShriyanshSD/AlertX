import { createAdapter } from '@socket.io/mongo-adapter';
import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { createApp } from '../server/app.js';
import { connectDatabase } from '../server/config/database.js';
import { assertConfig, config } from '../server/config/env.js';
import { createServerlessDemoSimulator } from '../server/services/serverlessDemoSimulator.js';
import { attachSocketServer } from '../server/sockets/index.js';

assertConfig();
await connectDatabase();

const simulator = createServerlessDemoSimulator({
  intervalMs: config.demoGpsIntervalMs,
  historyIntervalMs: config.locationHistoryIntervalMs,
});
const app = createApp({
  simulator,
  trustProxy: true,
  requestPathPrefix: '/api/server',
});

const server = createServer(app);
const io = attachSocketServer(server, app, { path: '/api/server/socket.io' });
const socketEvents = mongoose.connection.db.collection('resq_socket_events');
await socketEvents.createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 });
io.adapter(createAdapter(socketEvents, { addCreatedAtField: true }));
simulator.setIo(io);
if (config.demoSimulationAutostart) await simulator.start();

export default server;
