import { io } from 'socket.io-client';

// Single Socket.IO instance shared across the app
const socket = io('/', {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  auth: {
    token: localStorage.getItem('lecturelens_token') || '',
  },
});

// Keep auth token fresh on reconnect (e.g. after login/page refresh)
socket.on('connect', () => {
  const token = localStorage.getItem('lecturelens_token');
  if (token && socket.auth) {
    socket.auth.token = token;
  }
});

export default socket;
