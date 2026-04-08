/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://office.thehelloteam.com';

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!isAuthenticated || !user || !token) return undefined;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    // Keep state in sync immediately (preserves previous behavior)
    socketRef.current = newSocket;
    const socketTimer = setTimeout(() => setSocket(newSocket), 0);

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('chat:get_online_users');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('chat:online_users', (users) => {
      setOnlineUsers(users);
    });

    newSocket.on('chat:user_online', ({ userId }) => {
      setOnlineUsers((prev) => {
        if (prev.includes(userId)) return prev;
        return [...prev, userId];
      });
    });

    newSocket.on('chat:user_offline', ({ userId }) => {
      setOnlineUsers((prev) => prev.filter((id) => id !== userId));
    });

    return () => {
      clearTimeout(socketTimer);
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers([]);
    };
  }, [isAuthenticated, user?.id]);

  const value = {
    socket,
    isConnected,
    onlineUsers,
    isUserOnline: (userId) => onlineUsers.includes(userId),
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
