import { useState, useEffect, useCallback } from 'react';
import {
  cacheCounter,
  cacheSession,
  cacheNote,
  addToSyncQueue,
  getCacheSize,
} from '../utils/offline/db';
import { syncManager } from '../utils/offline/syncManager';
import axios from 'axios';

export const useOffline = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cacheSize, setCacheSize] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Get initial cache size
    getCacheSize().then(setCacheSize);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Perform a request with offline support
   * If online: make normal request and cache result
   * If offline: use cached data and queue the change
   */
  const offlineRequest = useCallback(
    async <T = any>(config: {
      endpoint: string;
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      data?: any;
      cacheKey?: string;
      cacheGetter?: () => Promise<any>;
      cacheSetter?: (data: any) => Promise<void>;
    }): Promise<T> => {
      const { endpoint, method = 'GET', data, cacheKey: _cacheKey, cacheGetter, cacheSetter } = config;

      // If online, make normal request
      if (isOnline) {
        try {
          const response = await axios({
            url: endpoint,
            method,
            data,
          });

          // Cache the response if cacheSetter is provided
          if (cacheSetter && response.data) {
            await cacheSetter(response.data);
          }

          // Update cache size
          getCacheSize().then(setCacheSize);

          return response.data;
        } catch (error) {
          // If request fails, fall back to cache for GET requests
          if (method === 'GET' && cacheGetter) {
            const cached = await cacheGetter();
            if (cached) {
              console.log('Using cached data due to network error');
              return cached.data || cached;
            }
          }
          throw error;
        }
      }

      // If offline, handle based on method
      if (method === 'GET') {
        // For GET requests, try to get from cache
        if (cacheGetter) {
          const cached = await cacheGetter();
          if (cached) {
            return cached.data || cached;
          }
        }
        throw new Error('No cached data available and device is offline');
      } else {
        // For mutations, add to sync queue and return optimistic result
        await addToSyncQueue({
          type: 'mutation',
          endpoint,
          method,
          data,
        });

        // If cacheSetter is provided, update cache optimistically
        if (cacheSetter && data) {
          await cacheSetter(data);
        }

        // Update cache size
        getCacheSize().then(setCacheSize);

        // Return the data optimistically
        return data;
      }
    },
    [isOnline]
  );

  /**
   * Update counter with offline support
   */
  const updateCounterOffline = useCallback(
    async (counterId: string, projectId: string, newValue: number) => {
      const counterData = { id: counterId, project_id: projectId, current_value: newValue };

      return offlineRequest({
        endpoint: `/api/counters/${counterId}`,
        method: 'PUT',
        data: { current_value: newValue },
        cacheSetter: async () => {
          await cacheCounter(counterData, !isOnline);
        },
      });
    },
    [offlineRequest, isOnline]
  );

  /**
   * Save session with offline support
   */
  const saveSessionOffline = useCallback(
    async (session: any) => {
      return offlineRequest({
        endpoint: `/api/sessions`,
        method: 'POST',
        data: session,
        cacheSetter: async () => {
          await cacheSession(session, !isOnline);
        },
      });
    },
    [offlineRequest, isOnline]
  );

  /**
   * Save note with offline support
   */
  const saveNoteOffline = useCallback(
    async (note: any, type: 'audio' | 'handwritten' | 'structured') => {
      return offlineRequest({
        endpoint: `/api/notes`,
        method: 'POST',
        data: note,
        cacheSetter: async () => {
          await cacheNote(note, type, !isOnline);
        },
      });
    },
    [offlineRequest, isOnline]
  );

  /**
   * Trigger manual sync
   */
  const sync = useCallback(async () => {
    await syncManager.sync();
  }, []);

  return {
    isOnline,
    cacheSize,
    offlineRequest,
    updateCounterOffline,
    saveSessionOffline,
    saveNoteOffline,
    sync,
  };
};
