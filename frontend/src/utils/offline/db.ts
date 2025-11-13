import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface RowlyOfflineDB extends DBSchema {
  patterns: {
    key: string;
    value: {
      id: string;
      name: string;
      file_url: string;
      data: any;
      cached_at: string;
    };
  };
  'pdf-cache': {
    key: string;
    value: {
      patternId: string;
      blob: Blob;
      cached_at: string;
    };
  };
  counters: {
    key: string;
    value: {
      id: string;
      project_id: string;
      value: number;
      updated_at: number;
      synced: boolean;
    };
  };
  'sync-queue': {
    key: number;
    value: {
      id?: number;
      type: string;
      endpoint: string;
      method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      data: any;
      timestamp: number;
      synced: boolean;
      retries: number;
    };
    autoIncrement: true;
  };
  projects: {
    key: string;
    value: {
      id: string;
      data: any;
      cached_at: string;
    };
  };
  sessions: {
    key: string;
    value: {
      id: string;
      project_id: string;
      data: any;
      cached_at: string;
      synced: boolean;
    };
  };
  notes: {
    key: string;
    value: {
      id: string;
      type: 'audio' | 'handwritten' | 'structured';
      data: any;
      cached_at: string;
      synced: boolean;
    };
  };
}

const DB_NAME = 'rowly-offline';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<RowlyOfflineDB> | null = null;

export const initDB = async (): Promise<IDBPDatabase<RowlyOfflineDB>> => {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<RowlyOfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Pattern files
      if (!db.objectStoreNames.contains('patterns')) {
        db.createObjectStore('patterns', { keyPath: 'id' });
      }

      // PDF cache
      if (!db.objectStoreNames.contains('pdf-cache')) {
        db.createObjectStore('pdf-cache', { keyPath: 'patternId' });
      }

      // Counters
      if (!db.objectStoreNames.contains('counters')) {
        const counterStore = db.createObjectStore('counters', { keyPath: 'id' });
        counterStore.createIndex('project_id', 'project_id');
        counterStore.createIndex('synced', 'synced');
      }

      // Sync queue
      if (!db.objectStoreNames.contains('sync-queue')) {
        const syncStore = db.createObjectStore('sync-queue', {
          keyPath: 'id',
          autoIncrement: true,
        });
        syncStore.createIndex('synced', 'synced');
        syncStore.createIndex('timestamp', 'timestamp');
      }

      // Projects
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
      }

      // Sessions
      if (!db.objectStoreNames.contains('sessions')) {
        const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
        sessionStore.createIndex('project_id', 'project_id');
        sessionStore.createIndex('synced', 'synced');
      }

      // Notes
      if (!db.objectStoreNames.contains('notes')) {
        const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
        noteStore.createIndex('type', 'type');
        noteStore.createIndex('synced', 'synced');
      }
    },
  });

  return dbInstance;
};

export const getDB = async (): Promise<IDBPDatabase<RowlyOfflineDB>> => {
  if (!dbInstance) {
    return initDB();
  }
  return dbInstance;
};

// Pattern operations
export const cachePattern = async (pattern: any) => {
  const db = await getDB();
  await db.put('patterns', {
    id: pattern.id,
    name: pattern.name,
    file_url: pattern.file_url,
    data: pattern,
    cached_at: new Date().toISOString(),
  });
};

export const getPatternFromCache = async (patternId: string) => {
  const db = await getDB();
  return db.get('patterns', patternId);
};

export const getAllCachedPatterns = async () => {
  const db = await getDB();
  return db.getAll('patterns');
};

// PDF cache operations
export const cachePDF = async (patternId: string, blob: Blob) => {
  const db = await getDB();
  await db.put('pdf-cache', {
    patternId,
    blob,
    cached_at: new Date().toISOString(),
  });
};

export const getPDFFromCache = async (patternId: string) => {
  const db = await getDB();
  return db.get('pdf-cache', patternId);
};

// Counter operations
export const cacheCounter = async (counter: any, synced = true) => {
  const db = await getDB();
  await db.put('counters', {
    id: counter.id,
    project_id: counter.project_id,
    value: counter.current_value,
    updated_at: Date.now(),
    synced,
  });
};

export const getCounterFromCache = async (counterId: string) => {
  const db = await getDB();
  return db.get('counters', counterId);
};

export const getProjectCountersFromCache = async (projectId: string) => {
  const db = await getDB();
  const index = db.transaction('counters').store.index('project_id');
  return index.getAll(projectId);
};

// Sync queue operations
export const addToSyncQueue = async (item: {
  type: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data: any;
}) => {
  const db = await getDB();
  await db.add('sync-queue', {
    ...item,
    timestamp: Date.now(),
    synced: false,
    retries: 0,
  });
};

export const getSyncQueue = async () => {
  const db = await getDB();
  return db.getAll('sync-queue');
};

export const getUnsyncedItems = async () => {
  const db = await getDB();
  const index = db.transaction('sync-queue').store.index('synced');
  return index.getAll(false);
};

export const markSyncItemComplete = async (id: number) => {
  const db = await getDB();
  const item = await db.get('sync-queue', id);
  if (item) {
    await db.put('sync-queue', { ...item, synced: true });
  }
};

export const incrementSyncRetry = async (id: number) => {
  const db = await getDB();
  const item = await db.get('sync-queue', id);
  if (item) {
    await db.put('sync-queue', { ...item, retries: item.retries + 1 });
  }
};

export const deleteSyncItem = async (id: number) => {
  const db = await getDB();
  await db.delete('sync-queue', id);
};

// Project operations
export const cacheProject = async (project: any) => {
  const db = await getDB();
  await db.put('projects', {
    id: project.id,
    data: project,
    cached_at: new Date().toISOString(),
  });
};

export const getProjectFromCache = async (projectId: string) => {
  const db = await getDB();
  return db.get('projects', projectId);
};

// Session operations
export const cacheSession = async (session: any, synced = true) => {
  const db = await getDB();
  await db.put('sessions', {
    id: session.id,
    project_id: session.project_id,
    data: session,
    cached_at: new Date().toISOString(),
    synced,
  });
};

export const getSessionFromCache = async (sessionId: string) => {
  const db = await getDB();
  return db.get('sessions', sessionId);
};

export const getProjectSessionsFromCache = async (projectId: string) => {
  const db = await getDB();
  const index = db.transaction('sessions').store.index('project_id');
  const sessions = await index.getAll(projectId);
  return sessions.map((s) => s.data);
};

// Note operations
export const cacheNote = async (note: any, type: 'audio' | 'handwritten' | 'structured', synced = true) => {
  const db = await getDB();
  await db.put('notes', {
    id: note.id,
    type,
    data: note,
    cached_at: new Date().toISOString(),
    synced,
  });
};

export const getNoteFromCache = async (noteId: string) => {
  const db = await getDB();
  return db.get('notes', noteId);
};

export const getUnsyncedNotes = async () => {
  const db = await getDB();
  const index = db.transaction('notes').store.index('synced');
  return index.getAll(false);
};

// Clear all cache
export const clearCache = async () => {
  const db = await getDB();
  const stores = ['patterns', 'pdf-cache', 'counters', 'projects', 'sessions', 'notes'];

  for (const store of stores) {
    await db.clear(store as any);
  }
};

// Get cache size estimate
export const getCacheSize = async (): Promise<number> => {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return estimate.usage || 0;
  }
  return 0;
};
