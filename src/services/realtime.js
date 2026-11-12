import { io } from 'socket.io-client';

let sharedSocket = null;
let referenceCount = 0;
let generation = 0;

function getSocket() {
  if (!sharedSocket) {
    const isProductionBuild = import.meta.env.MODE === 'production';
    const url = import.meta.env.VITE_SOCKET_URL || undefined;
    sharedSocket = io(url, {
      path: import.meta.env.VITE_SOCKET_PATH
        || (isProductionBuild ? '/api/server/socket.io' : '/socket.io'),
      addTrailingSlash: !isProductionBuild,
      ...(isProductionBuild ? { transports: ['websocket'] } : {}),
      withCredentials: true,
      autoConnect: true,
      reconnectionAttempts: Infinity,
      timeout: 8000,
    });
  } else if (!sharedSocket.connected) {
    sharedSocket.connect();
  }
  return sharedSocket;
}

export function connectRealtime() {
  const socket = getSocket();
  const socketGeneration = generation;
  referenceCount += 1;
  let released = false;
  const client = {
    on: (...args) => { socket.on(...args); return client; },
    off: (...args) => { socket.off(...args); return client; },
    emit: (...args) => { socket.emit(...args); return client; },
    get connected() { return socket.connected; },
    disconnect() {
      if (released) return;
      released = true;
      if (socketGeneration !== generation) return;
      referenceCount = Math.max(0, referenceCount - 1);
      if (referenceCount === 0) socket.disconnect();
    },
  };
  return client;
}

export function disconnectRealtime() {
  generation += 1;
  referenceCount = 0;
  sharedSocket?.disconnect();
  sharedSocket = null;
}
