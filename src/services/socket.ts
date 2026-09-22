import { io, Socket } from 'socket.io-client';
import { getApiBaseUrl, getStoredToken } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const baseUrl = getApiBaseUrl();
    socket = io(baseUrl || undefined, {
      autoConnect: false,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });
  }
  const token = getStoredToken();
  socket.auth = token ? { token } : {};
  return socket;
}

export function connectSocket(): Socket {
  const currentSocket = getSocket();
  if (!getStoredToken()) return currentSocket;
  if (currentSocket.connected) return currentSocket;

  if (currentSocket.active) {
    // Socket.IO is already retrying. Nudge it so a stale transport that never
    // emitted `disconnect` (laptop sleep, throttled tab, network switch) is
    // torn down and re-established instead of hanging forever.
    currentSocket.disconnect();
  }
  currentSocket.connect();
  return currentSocket;
}

/** True when the realtime connection is currently usable. */
export function isSocketHealthy(): boolean {
  return Boolean(socket?.connected);
}
