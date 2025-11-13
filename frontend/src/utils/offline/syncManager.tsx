import React from 'react';
import axios from 'axios';
import {
  getUnsyncedItems,
  markSyncItemComplete,
  incrementSyncRetry,
  deleteSyncItem,
  getSyncQueue,
} from './db';

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // Start with 2 seconds

export interface SyncStatus {
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncTime?: Date;
}

class SyncManager {
  private isSyncing = false;
  private syncListeners: Set<(status: SyncStatus) => void> = new Set();

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  /**
   * Subscribe to sync status updates
   */
  onSyncStatusChange(callback: (status: SyncStatus) => void) {
    this.syncListeners.add(callback);
    return () => this.syncListeners.delete(callback);
  }

  /**
   * Notify all listeners of sync status change
   */
  private notifyListeners(status: SyncStatus) {
    this.syncListeners.forEach((listener) => listener(status));
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const queue = await getSyncQueue();
    const pending = queue.filter((item) => !item.synced);
    const failed = pending.filter((item) => item.retries >= MAX_RETRIES);

    return {
      isSyncing: this.isSyncing,
      pendingCount: pending.length,
      failedCount: failed.length,
      lastSyncTime: undefined, // Could track this in localStorage
    };
  }

  /**
   * Handle when device comes online
   */
  private async handleOnline() {
    console.log('Device is online, starting sync...');
    await this.processSyncQueue();
  }

  /**
   * Handle when device goes offline
   */
  private handleOffline() {
    console.log('Device is offline');
    this.isSyncing = false;
  }

  /**
   * Process the sync queue
   */
  async processSyncQueue(): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    if (!navigator.onLine) {
      console.log('Device is offline, skipping sync');
      return;
    }

    this.isSyncing = true;
    this.notifyListeners(await this.getSyncStatus());

    try {
      const unsyncedItems = await getUnsyncedItems();
      console.log(`Processing ${unsyncedItems.length} unsynced items`);

      for (const item of unsyncedItems) {
        // Skip items that have exceeded max retries
        if (item.retries >= MAX_RETRIES) {
          console.error(`Item ${item.id} has exceeded max retries, skipping`);
          continue;
        }

        try {
          await this.syncItem(item);
          await markSyncItemComplete(item.id!);
          console.log(`Successfully synced item ${item.id}`);
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error);
          await incrementSyncRetry(item.id!);

          // Exponential backoff
          const delay = RETRY_DELAY * Math.pow(2, item.retries);
          await this.sleep(delay);
        }
      }

      // Notify listeners that sync is complete
      this.notifyListeners(await this.getSyncStatus());
    } catch (error) {
      console.error('Error processing sync queue:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single item
   */
  private async syncItem(item: any): Promise<void> {
    const config = {
      method: item.method,
      url: item.endpoint,
      data: item.data,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    await axios(config);
  }

  /**
   * Manually trigger sync
   */
  async sync(): Promise<void> {
    return this.processSyncQueue();
  }

  /**
   * Clear sync queue (useful for debugging/testing)
   */
  async clearQueue(): Promise<void> {
    const queue = await getSyncQueue();
    for (const item of queue) {
      if (item.id) {
        await deleteSyncItem(item.id);
      }
    }
    this.notifyListeners(await this.getSyncStatus());
  }

  /**
   * Get failed sync items (exceeded max retries)
   */
  async getFailedItems() {
    const queue = await getSyncQueue();
    return queue.filter((item) => !item.synced && item.retries >= MAX_RETRIES);
  }

  /**
   * Retry failed items
   */
  async retryFailed(): Promise<void> {
    const failed = await this.getFailedItems();
    for (const item of failed) {
      if (item.id) {
        // Reset retries to 0
        const db = await import('./db').then((m) => m.getDB());
        await db.put('sync-queue', { ...item, retries: 0 });
      }
    }
    await this.processSyncQueue();
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const syncManager = new SyncManager();

/**
 * React hook for sync status
 */
export const useSyncStatus = (callback: (status: SyncStatus) => void) => {
  React.useEffect(() => {
    const unsubscribe = syncManager.onSyncStatusChange(callback);

    // Get initial status
    syncManager.getSyncStatus().then(callback);

    return unsubscribe;
  }, [callback]);
};
