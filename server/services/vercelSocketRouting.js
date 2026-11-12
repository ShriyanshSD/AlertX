import { getVercelRequestPath } from '../utils/vercelRequestPath.js';

function isSocketRequest(request, socketPath) {
  const rewrittenPath = getVercelRequestPath(request.url);
  if (rewrittenPath) request.url = rewrittenPath;
  const requestPath = new URL(request.url, 'http://localhost').pathname.replace(/\/$/, '');
  return requestPath === socketPath.replace(/\/$/, '');
}

export function installVercelSocketRouting(server, app, io, socketPath) {
  server.removeAllListeners('request');
  server.on('request', (request, response) => {
    if (isSocketRequest(request, socketPath)) {
      io.engine.handleRequest(request, response);
      return;
    }
    app(request, response);
  });

  server.removeAllListeners('upgrade');
  server.on('upgrade', (request, socket, head) => {
    if (isSocketRequest(request, socketPath)) {
      io.engine.handleUpgrade(request, socket, head);
      return;
    }
    socket.destroy();
  });
}
