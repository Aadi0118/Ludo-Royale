import { io } from 'socket.io-client';

// In production, the backend and frontend are hosted on the same domain,
// so we use undefined which tells socket.io to connect to the current host.
// In development, we connect to the local backend port.
const SOCKET_URL = import.meta.env.PROD ? undefined : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000');

export const socket = io(SOCKET_URL, {
  autoConnect: false, // Wait until we explicitly connect
});
