import { io } from 'socket.io-client';

// Use environment variable for backend URL in production, local for development
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export const socket = io(SOCKET_URL, {
  autoConnect: false, // Wait until we explicitly connect
});
