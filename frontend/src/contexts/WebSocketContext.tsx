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
  const { accessToken, refreshToken } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);
  const isRefreshingRef = useRef(false);

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

    // Create Socket.IO connection
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
      console.log('✅ Socket.IO connected:', newSocket.id);
      setIsConnected(true);
      isRefreshingRef.current = false;
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', async (error) => {
      console.error('Socket.IO connection error:', error);
      setIsConnected(false);

      // Check if it's an authentication error
      const errorMessage = error.message.toLowerCase();
      if (
        (errorMessage.includes('auth') ||
          errorMessage.includes('unauthorized') ||
          errorMessage.includes('jwt') ||
          errorMessage.includes('token')) &&
        !isRefreshingRef.current
      ) {
        isRefreshingRef.current = true;
        console.log('🔄 Attempting to refresh token for Socket.IO...');

        try {
          const newToken = await refreshToken();

          if (newToken) {
            console.log('✅ Token refreshed successfully, reconnecting Socket.IO...');

            // Update socket auth token
            if (newSocket.auth) {
              (newSocket.auth as any).token = newToken;
            }

            // Reconnect with new token
            newSocket.connect();
          } else {
            console.error('❌ Token refresh failed, cannot reconnect Socket.IO');
          }
        } catch (refreshError) {
          console.error('❌ Error during token refresh:', refreshError);
        } finally {
          isRefreshingRef.current = false;
        }
      }
    });

    // Listen for auth error events from server
    newSocket.on('error', async (error: any) => {
      console.error('Socket.IO error event:', error);

      // Check if it's an authentication error
      if (
        (error.type === 'auth' ||
          error.message?.includes('auth') ||
          error.message?.includes('unauthorized') ||
          error.message?.includes('token')) &&
        !isRefreshingRef.current
      ) {
        isRefreshingRef.current = true;
        console.log('🔄 Auth error received, attempting to refresh token...');

        try {
          const newToken = await refreshToken();

          if (newToken) {
            console.log('✅ Token refreshed, reconnecting Socket.IO...');

            // Disconnect and reconnect with new token
            newSocket.disconnect();

            if (newSocket.auth) {
              (newSocket.auth as any).token = newToken;
            }

            newSocket.connect();
          }
        } catch (refreshError) {
          console.error('❌ Error during token refresh:', refreshError);
        } finally {
          isRefreshingRef.current = false;
        }
      }
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
  }, [accessToken, refreshToken]);

  const joinProject = useCallback((projectId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join:project', projectId);
      console.log(`Joined project room: ${projectId}`);
    }
  }, []);

  const leaveProject = useCallback((projectId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave:project', projectId);
      console.log(`Left project room: ${projectId}`);
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

  const onCounterUpdate = useCallback((callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on('counter:updated', callback);
      socketRef.current.on('counter:incremented', callback);
      socketRef.current.on('counter:decremented', callback);
    }
  }, []);

  const offCounterUpdate = useCallback((callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.off('counter:updated', callback);
      socketRef.current.off('counter:incremented', callback);
      socketRef.current.off('counter:decremented', callback);
    }
  }, []);

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
