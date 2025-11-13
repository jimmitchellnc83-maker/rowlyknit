import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

export interface DataConflict {
  id: string;
  resourceType: 'counter' | 'session' | 'note' | 'project';
  resourceId: string;
  localValue: any;
  serverValue: any;
  lastSyncedValue?: any;
  field: string;
  timestamp: number;
}

interface ConflictResolverProps {
  conflicts: DataConflict[];
  onResolve: (conflictId: string, resolution: 'local' | 'server' | 'merge') => Promise<void>;
  onResolveAll: (resolution: 'local' | 'server') => Promise<void>;
}

export const ConflictResolver: React.FC<ConflictResolverProps> = ({
  conflicts,
  onResolve,
  onResolveAll,
}) => {
  const [expandedConflict, setExpandedConflict] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  if (conflicts.length === 0) {
    return null;
  }

  const handleResolve = async (conflictId: string, resolution: 'local' | 'server' | 'merge') => {
    setResolving(conflictId);
    try {
      await onResolve(conflictId, resolution);
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      alert('Failed to resolve conflict');
    } finally {
      setResolving(null);
    }
  };

  const handleResolveAll = async (resolution: 'local' | 'server') => {
    if (
      !confirm(
        `Are you sure you want to use ${resolution === 'local' ? 'local' : 'server'} version for all conflicts?`
      )
    ) {
      return;
    }

    try {
      await onResolveAll(resolution);
    } catch (error) {
      console.error('Failed to resolve all conflicts:', error);
      alert('Failed to resolve conflicts');
    }
  };

  const toggleExpand = (conflictId: string) => {
    setExpandedConflict(expandedConflict === conflictId ? null : conflictId);
  };

  const renderValue = (value: any): string => {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const getResourceTypeLabel = (type: string): string => {
    switch (type) {
      case 'counter':
        return 'Counter';
      case 'session':
        return 'Session';
      case 'note':
        return 'Note';
      case 'project':
        return 'Project';
      default:
        return type;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-2 border-orange-500">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-6 h-6 text-orange-600" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Sync Conflicts Detected
        </h3>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} found between your local
        changes and the server. Please review and resolve each conflict.
      </p>

      {/* Bulk Actions */}
      <div className="flex gap-3 mb-6 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <button
          onClick={() => handleResolveAll('local')}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
        >
          Use Local for All
        </button>
        <button
          onClick={() => handleResolveAll('server')}
          className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors text-sm"
        >
          Use Server for All
        </button>
      </div>

      {/* Conflict List */}
      <div className="space-y-3">
        {conflicts.map((conflict) => {
          const isExpanded = expandedConflict === conflict.id;
          const isResolving = resolving === conflict.id;

          return (
            <div
              key={conflict.id}
              className="border border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden"
            >
              {/* Conflict Header */}
              <button
                onClick={() => toggleExpand(conflict.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
              >
                <div className="flex items-center gap-3 text-left">
                  <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {getResourceTypeLabel(conflict.resourceType)} - {conflict.field}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      ID: {conflict.resourceId.slice(0, 8)}...
                    </div>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {/* Conflict Details */}
              {isExpanded && (
                <div className="px-4 py-4 bg-orange-50 dark:bg-orange-900/20 border-t border-orange-200 dark:border-orange-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Local Version */}
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Your Local Version
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border border-blue-200 dark:border-blue-800">
                        <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap">
                          {renderValue(conflict.localValue)}
                        </pre>
                      </div>
                    </div>

                    {/* Server Version */}
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Server Version
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                        <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap">
                          {renderValue(conflict.serverValue)}
                        </pre>
                      </div>
                    </div>
                  </div>

                  {/* Last Synced Value (if available) */}
                  {conflict.lastSyncedValue && (
                    <div className="mb-4">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Last Synced Value (for reference)
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                        <pre className="text-xs text-gray-500 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap">
                          {renderValue(conflict.lastSyncedValue)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Resolution Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleResolve(conflict.id, 'local')}
                      disabled={isResolving}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                    >
                      {isResolving ? 'Resolving...' : 'Use Local'}
                    </button>
                    <button
                      onClick={() => handleResolve(conflict.id, 'server')}
                      disabled={isResolving}
                      className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                    >
                      {isResolving ? 'Resolving...' : 'Use Server'}
                    </button>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    Conflict detected at:{' '}
                    {new Date(conflict.timestamp).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
