import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { assertConfig, config } from './config/env.js';
import { createDemoSimulator } from './services/demoSimulator.js';
import { attachSocketServer } from './sockets/index.js';

export async function startServer() {
  assertConfig();
  await connectDatabase();
  const simulator = createDemoSimulator({
    intervalMs: config.demoGpsIntervalMs,
    historyIntervalMs: config.locationHistoryIntervalMs,
  });
  const app = createApp({ simulator });
  const server = createServer(app);
  const io = attachSocketServer(server, app);
  simulator.setIo(io);
  if (config.demoSimulationAutostart) simulator.start();

  server.on('close', async () => {
    simulator.stop();
    io.close();
    await disconnectDatabase();
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, resolve);
  });
  console.log(`ResQ API listening on port ${config.port}.`);
  return { app, server, io, simulator };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  startServer().catch(async (error) => {
    console.error('ResQ API failed to start.', error);
    await disconnectDatabase();
    process.exitCode = 1;
  });
}
