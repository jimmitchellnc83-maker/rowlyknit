import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
  emitCounterUpdate: (counterId: string, projectId: string, currentValue: number) => void;
  emitCounterIncrement: (counterId: string, projectId: string, currentValue: number) => void;
  emitCounterDecrement: (counterId: string, projectId: string, currentValue: number) => void;
  emitCounterReset: (counterId: string, projectId: string) => void;
  onCounterUpdate: (callback: (data: { counterId: string; projectId: string; currentValue: number }) => void) => void;
  offCounterUpdate: (callback: (data: { counterId: string; projectId: string; currentValue: number }) => void) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { accessToken } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!accessToken) {
      // Disconnect if no token
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Create Socket.IO connection. Fall back to same-origin (window.location.origin)
    // rather than http://localhost:5000 so dev Firefox doesn't fail the
    // cross-origin WebSocket handshake; Vite dev server proxies /socket.io
    // through to the backend, and prod is already same-origin.
    const socketUrl = import.meta.env.VITE_API_URL || window.location.origin;

    const newSocket = io(socketUrl, {
      auth: {
        token: accessToken,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      setIsConnected(false);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [accessToken]);

  const joinProject = useCallback((projectId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join:project', projectId);
    }
  }, []);

  const leaveProject = useCallback((projectId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave:project', projectId);
    }
  }, []);

  const emitCounterUpdate = useCallback((counterId: string, projectId: string, currentValue: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('counter:update', { counterId, projectId, currentValue });
    }
  }, []);

  const emitCounterIncrement = useCallback((counterId: string, projectId: string, currentValue: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('counter:increment', { counterId, projectId, currentValue });
    }
  }, []);

  const emitCounterDecrement = useCallback((counterId: string, projectId: string, currentValue: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('counter:decrement', { counterId, projectId, currentValue });
    }
  }, []);

  const emitCounterReset = useCallback((counterId: string, projectId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('counter:reset', { counterId, projectId });
    }
  }, []);

  // Use socket state (not just ref) as dependency so callbacks rebind after reconnect
  const onCounterUpdate = useCallback((callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on('counter:updated', callback);
      socketRef.current.on('counter:incremented', callback);
      socketRef.current.on('counter:decremented', callback);
    }
  }, [socket]);

  const offCounterUpdate = useCallback((callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.off('counter:updated', callback);
      socketRef.current.off('counter:incremented', callback);
      socketRef.current.off('counter:decremented', callback);
    }
  }, [socket]);

  const value: WebSocketContextType = {
    socket,
    isConnected,
    joinProject,
    leaveProject,
    emitCounterUpdate,
    emitCounterIncrement,
    emitCounterDecrement,
    emitCounterReset,
    onCounterUpdate,
    offCounterUpdate,
  };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
