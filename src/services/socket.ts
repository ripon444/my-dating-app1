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
  if (token && !socket.connected && !socket.active) socket.connect();
  return socket;
}

