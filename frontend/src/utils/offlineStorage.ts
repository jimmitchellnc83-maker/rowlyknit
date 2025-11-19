import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface RowlyDB extends DBSchema {
  projects: {
    key: string;
    value: {
      id: string;
      name: string;
      description: string;
      status: string;
      data: any;
      updatedAt: number;
    };
  };
  patterns: {
    key: string;
    value: {
      id: string;
      name: string;
      data: any;
      updatedAt: number;
    };
  };
  yarn: {
    key: string;
    value: {
      id: string;
      brand: string;
      name: string;
      data: any;
      updatedAt: number;
    };
  };
  pendingSync: {
    key: number;
    value: {
      id?: number;
      type: 'create' | 'update' | 'delete';
      entity: 'projects' | 'patterns' | 'yarn' | 'counters' | 'photos';
      entityId?: string;
      data: any;
      timestamp: number;
    };
    indexes: { 'by-timestamp': number };
  };
}

class OfflineStorage {
  private dbPromise: Promise<IDBPDatabase<RowlyDB>>;

  constructor() {
    this.dbPromise = this.initDB();
  }

  private async initDB(): Promise<IDBPDatabase<RowlyDB>> {
    return openDB<RowlyDB>('rowly-offline-db', 1, {
      upgrade(db) {
        // Projects store
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }

        // Patterns store
        if (!db.objectStoreNames.contains('patterns')) {
          db.createObjectStore('patterns', { keyPath: 'id' });
        }

        // Yarn store
        if (!db.objectStoreNames.contains('yarn')) {
          db.createObjectStore('yarn', { keyPath: 'id' });
        }

        // Pending sync queue
        if (!db.objectStoreNames.contains('pendingSync')) {
          const syncStore = db.createObjectStore('pendingSync', {
            keyPath: 'id',
            autoIncrement: true,
          });
          syncStore.createIndex('by-timestamp', 'timestamp');
        }
      },
    });
  }

  // Cache data for offline access
  async cacheProjects(projects: any[]): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction('projects', 'readwrite');

    await Promise.all(
      projects.map((project) =>
        tx.store.put({
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          data: project,
          updatedAt: Date.now(),
        })
      )
    );

    await tx.done;
  }

  async cachePatterns(patterns: any[]): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction('patterns', 'readwrite');

    await Promise.all(
      patterns.map((pattern) =>
        tx.store.put({
          id: pattern.id,
          name: pattern.name,
          data: pattern,
          updatedAt: Date.now(),
        })
      )
    );

    await tx.done;
  }

  async cacheYarn(yarns: any[]): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction('yarn', 'readwrite');

    await Promise.all(
      yarns.map((yarn) =>
        tx.store.put({
          id: yarn.id,
          brand: yarn.brand,
          name: yarn.name,
          data: yarn,
          updatedAt: Date.now(),
        })
      )
    );

    await tx.done;
  }

  // Retrieve cached data
  async getCachedProjects(): Promise<any[]> {
    const db = await this.dbPromise;
    const projects = await db.getAll('projects');
    return projects.map((p) => p.data);
  }

  async getCachedProject(id: string): Promise<any | null> {
    const db = await this.dbPromise;
    const project = await db.get('projects', id);
    return project ? project.data : null;
  }

  async getCachedPatterns(): Promise<any[]> {
    const db = await this.dbPromise;
    const patterns = await db.getAll('patterns');
    return patterns.map((p) => p.data);
  }

  async getCachedYarn(): Promise<any[]> {
    const db = await this.dbPromise;
    const yarns = await db.getAll('yarn');
    return yarns.map((y) => y.data);
  }

  // Queue operations for sync when back online
  async queueOperation(
    type: 'create' | 'update' | 'delete',
    entity: 'projects' | 'patterns' | 'yarn' | 'counters' | 'photos',
    data: any,
    entityId?: string
  ): Promise<void> {
    const db = await this.dbPromise;
    await db.add('pendingSync', {
      type,
      entity,
      entityId,
      data,
      timestamp: Date.now(),
    });
  }

  async getPendingOperations(): Promise<any[]> {
    const db = await this.dbPromise;
    return db.getAllFromIndex('pendingSync', 'by-timestamp');
  }

  async clearPendingOperation(id: number): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('pendingSync', id);
  }

  async clearAllPendingOperations(): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction('pendingSync', 'readwrite');
    await tx.store.clear();
    await tx.done;
  }

  // Clear all cached data
  async clearCache(): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(['projects', 'patterns', 'yarn'], 'readwrite');

    await Promise.all([
      tx.objectStore('projects').clear(),
      tx.objectStore('patterns').clear(),
      tx.objectStore('yarn').clear(),
    ]);

    await tx.done;
  }
}

export const offlineStorage = new OfflineStorage();
export default offlineStorage;
