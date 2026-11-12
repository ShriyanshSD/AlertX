export function emitToOperations(io, event, payload) {
  io?.to('dashboard:operations').emit(event, payload);
}

export function emitToAdmin(io, event, payload) {
  io?.to('dashboard:admin').emit(event, payload);
}

export function emitToUser(io, userId, event, payload) {
  io?.to(`user:${String(userId)}`).emit(event, payload);
}

export function emitToSos(io, sosId, event, payload) {
  io?.to(`sos:${sosId}`).emit(event, payload);
}
