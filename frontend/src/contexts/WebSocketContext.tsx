import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
  // Note: there's no client emit for counter changes anymore. The
  // server controller emits `counter:updated` after each write, which
  // the listener below picks up. See backend/src/config/socket.ts.
  onCounterUpdate: (callback: (data: { counterId: string; projectId: string; currentValue: number }) => void) => void;
  offCounterUpdate: (callback: (data: { counterId: string; projectId: string; currentValue: number }) => void) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  // Cookie-only auth: there is no JS-readable token after PR #389
  // final pass. Gate the socket on the persisted `isAuthenticated`
  // bit instead — the actual auth happens via the httpOnly access
  // cookie that the browser attaches to the socket handshake when
  // we connect with `withCredentials: true`.
  const { isAuthenticated } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      // Disconnect if not authenticated
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
      // Send the httpOnly accessToken cookie with the handshake. The
      // backend reads it out of `socket.handshake.headers.cookie` and
      // verifies the JWT before accepting the connection. No JS-readable
      // bearer token is required.
      withCredentials: true,
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
  }, [isAuthenticated]);

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
