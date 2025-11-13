import React, { useState } from 'react';
import { FiClock, FiPlus, FiTrash2, FiCheckCircle, FiCircle } from 'react-icons/fi';
import { ProjectMilestone } from '../../types/counter.types';
import { formatDuration as _formatDuration } from 'date-fns';

interface ProjectTimerProps {
  projectId: string;
  milestones: ProjectMilestone[];
  totalTimeSeconds: number;
  totalRows: number;
  completedRows: number;
  onAddMilestone: (milestone: Omit<ProjectMilestone, 'id' | 'created_at'>) => Promise<void>;
  onUpdateMilestone: (milestoneId: string, updates: Partial<ProjectMilestone>) => Promise<void>;
  onDeleteMilestone: (milestoneId: string) => Promise<void>;
}

export const ProjectTimer: React.FC<ProjectTimerProps> = ({
  projectId,
  milestones,
  totalTimeSeconds,
  totalRows,
  completedRows,
  onAddMilestone,
  onUpdateMilestone,
  onDeleteMilestone,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [_editingMilestone, _setEditingMilestone] = useState<ProjectMilestone | null>(null);
  const [newMilestone, setNewMilestone] = useState({
    name: '',
    target_rows: 0,
  });

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours === 0) return `${minutes}m`;
    if (hours < 10) return `${hours}h ${minutes}m`;
    return `${hours}h`;
  };

  const calculateRowsPerHour = (): number => {
    if (totalTimeSeconds === 0) return 0;
    const hours = totalTimeSeconds / 3600;
    return Math.round(completedRows / hours);
  };

  const calculateEstimatedCompletion = (): string => {
    const rowsPerHour = calculateRowsPerHour();
    if (rowsPerHour === 0) return 'Not enough data';

    const remainingRows = totalRows - completedRows;
    const estimatedHours = remainingRows / rowsPerHour;

    if (estimatedHours < 1) {
      return `~${Math.round(estimatedHours * 60)} minutes`;
    }
    if (estimatedHours < 24) {
      return `~${Math.round(estimatedHours)} hours`;
    }
    const days = Math.round(estimatedHours / 24);
    return `~${days} day${days !== 1 ? 's' : ''}`;
  };

  const handleAddMilestone = async () => {
    if (!newMilestone.name.trim()) return;

    try {
      await onAddMilestone({
        project_id: projectId,
        name: newMilestone.name,
        target_rows: newMilestone.target_rows || undefined,
        actual_rows: 0,
        time_spent_seconds: 0,
        sort_order: milestones.length,
      });

      setNewMilestone({ name: '', target_rows: 0 });
      setShowAddModal(false);
    } catch (error) {
      console.error('Failed to add milestone:', error);
    }
  };

  const handleCompleteMilestone = async (milestone: ProjectMilestone) => {
    try {
      await onUpdateMilestone(milestone.id, {
        completed_at: milestone.completed_at ? undefined : new Date().toISOString(),
        actual_rows: milestone.actual_rows || completedRows,
      });
    } catch (error) {
      console.error('Failed to complete milestone:', error);
    }
  };

  const progressPercentage = totalRows > 0 ? (completedRows / totalRows) * 100 : 0;
  const rowsPerHour = calculateRowsPerHour();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <FiClock className="w-5 h-5" />
          Project Progress
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          Add Milestone
        </button>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Time</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {formatTime(totalTimeSeconds)}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Rows Complete</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {completedRows}
            {totalRows > 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                /{totalRows}
              </span>
            )}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Average Pace</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {rowsPerHour}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">rows/hour</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Time Remaining</div>
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            {calculateEstimatedCompletion()}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {totalRows > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400">Overall Progress</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {progressPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Milestones */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Milestones
        </h4>

        {milestones.length === 0 ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <FiCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No milestones yet</p>
            <p className="text-xs mt-1">Break down your project into manageable sections</p>
          </div>
        ) : (
          <div className="space-y-2">
            {milestones
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((milestone) => {
                const isCompleted = !!milestone.completed_at;
                const milestoneProgress = milestone.target_rows
                  ? Math.min(
                      ((milestone.actual_rows || 0) / milestone.target_rows) * 100,
                      100
                    )
                  : 0;

                return (
                  <div
                    key={milestone.id}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      isCompleted
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-2 flex-1">
                        <button
                          onClick={() => handleCompleteMilestone(milestone)}
                          className="mt-0.5"
                        >
                          {isCompleted ? (
                            <FiCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <FiCircle className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                        <div className="flex-1">
                          <div
                            className={`font-medium ${
                              isCompleted
                                ? 'text-green-900 dark:text-green-300 line-through'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {milestone.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-x-3">
                            {milestone.target_rows && (
                              <span>
                                Target: {milestone.target_rows} rows
                              </span>
                            )}
                            {milestone.time_spent_seconds > 0 && (
                              <span>
                                Time: {formatTime(milestone.time_spent_seconds)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteMilestone(milestone.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 p-1"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Milestone Progress Bar */}
                    {milestone.target_rows && !isCompleted && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${milestoneProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Add Milestone Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Add Milestone
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Milestone Name
                </label>
                <input
                  type="text"
                  value={newMilestone.name}
                  onChange={(e) =>
                    setNewMilestone({ ...newMilestone, name: e.target.value })
                  }
                  placeholder="e.g., Ribbing, Body, Sleeves"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Target Rows (optional)
                </label>
                <input
                  type="number"
                  value={newMilestone.target_rows || ''}
                  onChange={(e) =>
                    setNewMilestone({
                      ...newMilestone,
                      target_rows: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="Number of rows for this section"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMilestone}
                disabled={!newMilestone.name.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                Add Milestone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
