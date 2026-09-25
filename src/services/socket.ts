import { io, Socket } from 'socket.io-client';
import { getApiBaseUrl, getStoredToken, removeStoredToken, removeStoredAuthSnapshot } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const baseUrl = getApiBaseUrl();
    socket = io(baseUrl || undefined, {
      autoConnect: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });

    socket.auth = (cb: (data: object) => void) => {
      const token = getStoredToken();
      cb(token ? { token } : {});
    };

    socket.on('connect_error', (err: Error) => {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('auth') || msg.includes('session') || msg.includes('token') || msg.includes('unauthorized')) {
        socket?.disconnect();
        removeStoredToken();
        removeStoredAuthSnapshot();
      }
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const currentSocket = getSocket();
  const token = getStoredToken();
  if (token && !currentSocket.connected && !currentSocket.active) {
    currentSocket.connect();
  }
  return currentSocket;
}


