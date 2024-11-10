import { io } from "socket.io-client";

// Initialize the socket connection
const socket = io(import.meta.env.VITE_BACKEND_URL, {
  withCredentials: true, // Allows cookies to be sent with Socket.IO connection (if needed)
  autoConnect: true,     // Automatically connects when imported
});

export default socket;
