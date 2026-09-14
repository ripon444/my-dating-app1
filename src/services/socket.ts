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
  if (getStoredToken() && !currentSocket.connected && !currentSocket.active) {
    currentSocket.connect();
  }
  return currentSocket;
}

