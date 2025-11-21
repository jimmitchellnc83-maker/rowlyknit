// @ts-nocheck
import { useState, useEffect } from 'react';
import { FiAlertCircle, FiPlus, FiTrash2, FiToggleLeft, FiToggleRight, FiClock, FiCheck, FiRepeat, FiBell, FiFlag } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';

interface MagicMarker {
  id: string;
  project_id: string;
  counter_id: string | null;
  name: string;
  trigger_type: string;
  trigger_condition: any;
  alert_message: string;
  alert_type: string;
  is_active: boolean;
  // Enhanced fields
  start_row: number | null;
  end_row: number | null;
  repeat_interval: number | null;
  repeat_offset: number | null;
  is_repeating: boolean;
  priority: 'low' | 'normal' | 'high' | 'critical';
  display_style: string;
  color: string | null;
  category: string;
  is_completed: boolean;
  snoozed_until: string | null;
  trigger_count: number;
  created_at: string;
}

interface Counter {
  id: string;
  name: string;
  current_value: number;
  target_value: number | null;
}

interface MagicMarkerManagerProps {
  projectId: string;
  counters: Counter[];
  currentRow?: number;
}

const TRIGGER_TYPES = [
  { value: 'row_range', label: 'Row Range (At the same time)' },
  { value: 'counter_value', label: 'Counter reaches value' },
  { value: 'row_interval', label: 'Every N rows' },
  { value: 'stitch_count', label: 'Stitch count milestone' },
  { value: 'time_based', label: 'Time-based reminder' },
];

const ALERT_TYPES = [
  { value: 'notification', label: 'Notification' },
  { value: 'sound', label: 'Sound' },
  { value: 'vibration', label: 'Vibration' },
  { value: 'visual', label: 'Visual' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-700' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700' },
];

const CATEGORIES = [
  { value: 'reminder', label: 'Reminder', icon: FiBell },
  { value: 'at_same_time', label: 'At the Same Time', icon: FiRepeat },
  { value: 'milestone', label: 'Milestone', icon: FiFlag },
  { value: 'shaping', label: 'Shaping', icon: FiFlag },
  { value: 'note', label: 'Note', icon: FiAlertCircle },
];

const DISPLAY_STYLES = [
  { value: 'banner', label: 'Banner (prominent)' },
  { value: 'popup', label: 'Popup (interruptive)' },
  { value: 'toast', label: 'Toast (subtle)' },
  { value: 'inline', label: 'Inline (always visible)' },
];

export default function MagicMarkerManager({ projectId, counters, currentRow }: MagicMarkerManagerProps) {
  const [markers, setMarkers] = useState<MagicMarker[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    counterId: '',
    triggerType: 'row_range',
    operator: 'equals',
    triggerValue: '',
    interval: '',
    alertMessage: '',
    alertType: 'notification',
    // Enhanced fields
    startRow: '',
    endRow: '',
    repeatInterval: '',
    repeatOffset: '0',
    isRepeating: false,
    priority: 'normal',
    displayStyle: 'banner',
    color: '',
    category: 'reminder',
  });

  useEffect(() => {
    fetchMarkers();
  }, [projectId]);

  const fetchMarkers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/projects/${projectId}/magic-markers`);
      setMarkers(response.data.data.magicMarkers || []);
    } catch (error) {
      console.error('Error fetching magic markers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a marker name');
      return;
    }

    if (!formData.alertMessage.trim()) {
      toast.error('Please enter an alert message');
      return;
    }

    let triggerCondition: any = {};

    switch (formData.triggerType) {
      case 'counter_value':
        if (!formData.triggerValue) {
          toast.error('Please enter trigger value');
          return;
        }
        triggerCondition = {
          operator: formData.operator,
          value: parseInt(formData.triggerValue),
        };
        break;
      case 'row_interval':
        if (!formData.interval) {
          toast.error('Please enter interval');
          return;
        }
        triggerCondition = {
          interval: parseInt(formData.interval),
        };
        break;
      case 'row_range':
        // Row range uses startRow/endRow fields
        break;
      case 'stitch_count':
        if (!formData.triggerValue) {
          toast.error('Please enter stitch count');
          return;
        }
        triggerCondition = {
          count: parseInt(formData.triggerValue),
        };
        break;
      case 'time_based':
        if (!formData.interval) {
          toast.error('Please enter time interval (minutes)');
          return;
        }
        triggerCondition = {
          minutes: parseInt(formData.interval),
        };
        break;
    }

    try {
      await axios.post(`/api/projects/${projectId}/magic-markers`, {
        name: formData.name,
        counterId: formData.counterId || null,
        triggerType: formData.triggerType,
        triggerCondition,
        alertMessage: formData.alertMessage,
        alertType: formData.alertType,
        isActive: true,
        // Enhanced fields
        startRow: formData.startRow ? parseInt(formData.startRow) : null,
        endRow: formData.endRow ? parseInt(formData.endRow) : null,
        repeatInterval: formData.repeatInterval ? parseInt(formData.repeatInterval) : null,
        repeatOffset: parseInt(formData.repeatOffset) || 0,
        isRepeating: formData.isRepeating,
        priority: formData.priority,
        displayStyle: formData.displayStyle,
        color: formData.color || null,
        category: formData.category,
      });

      toast.success('Magic marker created!');
      setShowModal(false);
      resetForm();
      fetchMarkers();
    } catch (error: any) {
      console.error('Error creating marker:', error);
      toast.error(error.response?.data?.message || 'Failed to create marker');
    }
  };

  const handleToggle = async (markerId: string) => {
    try {
      await axios.patch(`/api/projects/${projectId}/magic-markers/${markerId}/toggle`);
      fetchMarkers();
    } catch (error) {
      console.error('Error toggling marker:', error);
      toast.error('Failed to toggle marker');
    }
  };

  const handleSnooze = async (markerId: string, duration: number) => {
    try {
      await axios.post(`/api/projects/${projectId}/magic-markers/${markerId}/snooze`, {
        duration,
      });
      toast.success(`Snoozed for ${duration} minutes`);
      fetchMarkers();
    } catch (error) {
      console.error('Error snoozing marker:', error);
      toast.error('Failed to snooze marker');
    }
  };

  const handleComplete = async (markerId: string) => {
    try {
      await axios.post(`/api/projects/${projectId}/magic-markers/${markerId}/complete`);
      toast.success('Marked as completed!');
      fetchMarkers();
    } catch (error) {
      console.error('Error completing marker:', error);
      toast.error('Failed to complete marker');
    }
  };

  const handleDelete = async (markerId: string, name: string) => {
    if (!confirm(`Delete magic marker "${name}"?`)) return;

    try {
      await axios.delete(`/api/projects/${projectId}/magic-markers/${markerId}`);
      toast.success('Marker deleted');
      fetchMarkers();
    } catch (error) {
      console.error('Error deleting marker:', error);
      toast.error('Failed to delete marker');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      counterId: '',
      triggerType: 'row_range',
      operator: 'equals',
      triggerValue: '',
      interval: '',
      alertMessage: '',
      alertType: 'notification',
      startRow: '',
      endRow: '',
      repeatInterval: '',
      repeatOffset: '0',
      isRepeating: false,
      priority: 'normal',
      displayStyle: 'banner',
      color: '',
      category: 'reminder',
    });
  };

  const getTriggerDescription = (marker: MagicMarker) => {
    const condition = marker.trigger_condition || {};

    // Check for row range
    if (marker.start_row !== null || marker.end_row !== null) {
      let desc = '';
      if (marker.start_row !== null && marker.end_row !== null) {
        desc = `Rows ${marker.start_row}-${marker.end_row}`;
      } else if (marker.start_row !== null) {
        desc = `From row ${marker.start_row}`;
      } else if (marker.end_row !== null) {
        desc = `Until row ${marker.end_row}`;
      }

      if (marker.is_repeating && marker.repeat_interval) {
        desc += ` (every ${marker.repeat_interval} rows)`;
      }

      return desc;
    }

    switch (marker.trigger_type) {
      case 'counter_value':
        const operatorMap: Record<string, string> = {
          equals: '=',
          greater_than: '>',
          less_than: '<',
          multiple_of: 'is multiple of',
        };
        const operatorText = operatorMap[condition.operator as string] || condition.operator;
        return `When counter ${operatorText} ${condition.value}`;
      case 'row_interval':
        return `Every ${condition.interval} rows`;
      case 'stitch_count':
        return `At ${condition.count} stitches`;
      case 'time_based':
        return `Every ${condition.minutes} minutes`;
      default:
        return marker.trigger_type;
    }
  };

  const getPriorityClass = (priority: string) => {
    const p = PRIORITIES.find(pr => pr.value === priority);
    return p?.color || 'bg-gray-100 text-gray-700';
  };

  const isMarkerRelevantNow = (marker: MagicMarker) => {
    if (!currentRow) return false;
    if (!marker.is_active || marker.is_completed) return false;

    // Check snooze
    if (marker.snoozed_until && new Date(marker.snoozed_until) > new Date()) {
      return false;
    }

    // Check row range
    if (marker.start_row !== null && currentRow < marker.start_row) return false;
    if (marker.end_row !== null && currentRow > marker.end_row) return false;

    // Check repeating
    if (marker.is_repeating && marker.repeat_interval) {
      const offset = marker.repeat_offset || 0;
      if ((currentRow - offset) % marker.repeat_interval !== 0) return false;
    }

    return true;
  };

  // Sort markers: relevant first, then by priority, then by active status
  const sortedMarkers = [...markers].sort((a, b) => {
    const aRelevant = isMarkerRelevantNow(a);
    const bRelevant = isMarkerRelevantNow(b);
    if (aRelevant && !bRelevant) return -1;
    if (!aRelevant && bRelevant) return 1;

    const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
    const aPriority = priorityOrder[a.priority] || 2;
    const bPriority = priorityOrder[b.priority] || 2;
    if (aPriority !== bPriority) return bPriority - aPriority;

    if (a.is_active && !b.is_active) return -1;
    if (!a.is_active && b.is_active) return 1;

    return 0;
  });

  const relevantMarkers = sortedMarkers.filter(m => isMarkerRelevantNow(m));

  return (
    <div className="space-y-4">
      {/* Active Alerts Banner */}
      {relevantMarkers.length > 0 && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <FiBell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Active Reminders</h3>
              <p className="text-white/80 text-sm">
                {relevantMarkers.length} reminder{relevantMarkers.length !== 1 ? 's' : ''} for row {currentRow}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {relevantMarkers.map((marker) => (
              <div
                key={marker.id}
                className={`p-3 rounded-lg ${
                  marker.priority === 'critical' ? 'bg-red-500/30 border border-red-300/50' :
                  marker.priority === 'high' ? 'bg-orange-500/30 border border-orange-300/50' :
                  'bg-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{marker.name}</span>
                      {marker.priority !== 'normal' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          marker.priority === 'critical' ? 'bg-red-200 text-red-800' :
                          marker.priority === 'high' ? 'bg-orange-200 text-orange-800' :
                          'bg-gray-200 text-gray-800'
                        }`}>
                          {marker.priority}
                        </span>
                      )}
                    </div>
                    <p className="text-sm opacity-90">{marker.alert_message}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSnooze(marker.id, 5)}
                      className="p-1.5 hover:bg-white/20 rounded text-white/80 hover:text-white"
                      title="Snooze 5 min"
                    >
                      <FiClock className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleComplete(marker.id)}
                      className="p-1.5 hover:bg-white/20 rounded text-white/80 hover:text-white"
                      title="Mark complete"
                    >
                      <FiCheck className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FiAlertCircle className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Magic Markers</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">({markers.length})</span>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
          >
            <FiPlus className="h-4 w-4" />
            New Marker
          </button>
        </div>

        {/* Markers List */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : markers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <FiAlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p>No magic markers yet</p>
            <p className="text-sm mt-1">Create markers for "at the same time" instructions and important milestones</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedMarkers.map((marker) => {
              const isRelevant = isMarkerRelevantNow(marker);
              const isSnoozed = marker.snoozed_until && new Date(marker.snoozed_until) > new Date();

              return (
                <div
                  key={marker.id}
                  className={`border rounded-lg p-4 transition-all ${
                    marker.is_completed ? 'border-gray-200 bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600 opacity-60' :
                    isRelevant ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-600 ring-2 ring-purple-300' :
                    marker.is_active ? 'border-purple-200 bg-purple-50/50 dark:bg-gray-700 dark:border-purple-800' :
                    'border-gray-200 bg-gray-50 dark:bg-gray-700 dark:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{marker.name}</h3>

                        {/* Status badges */}
                        {marker.is_completed ? (
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full flex items-center gap-1">
                            <FiCheck className="h-3 w-3" /> Completed
                          </span>
                        ) : isSnoozed ? (
                          <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs rounded-full flex items-center gap-1">
                            <FiClock className="h-3 w-3" /> Snoozed
                          </span>
                        ) : marker.is_active ? (
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-full">
                            Inactive
                          </span>
                        )}

                        {/* Priority badge */}
                        {marker.priority !== 'normal' && (
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getPriorityClass(marker.priority)}`}>
                            {marker.priority}
                          </span>
                        )}

                        {/* Repeating badge */}
                        {marker.is_repeating && (
                          <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs rounded-full flex items-center gap-1">
                            <FiRepeat className="h-3 w-3" /> Repeating
                          </span>
                        )}

                        {/* Relevant now badge */}
                        {isRelevant && !marker.is_completed && (
                          <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full animate-pulse">
                            Now!
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {getTriggerDescription(marker)}
                      </p>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-500">Alert:</span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {marker.alert_message}
                        </span>
                      </div>

                      {marker.trigger_count > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          Triggered {marker.trigger_count} time{marker.trigger_count !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {!marker.is_completed && (
                        <>
                          <button
                            onClick={() => handleSnooze(marker.id, 5)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition"
                            title="Snooze 5 min"
                          >
                            <FiClock className="h-4 w-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleComplete(marker.id)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition"
                            title="Mark complete"
                          >
                            <FiCheck className="h-4 w-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleToggle(marker.id)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition"
                            title={marker.is_active ? 'Disable' : 'Enable'}
                          >
                            {marker.is_active ? (
                              <FiToggleRight className="h-5 w-5 text-green-600" />
                            ) : (
                              <FiToggleLeft className="h-5 w-5 text-gray-400" />
                            )}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(marker.id, marker.name)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition text-red-600"
                        title="Delete"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New Magic Marker</h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
              >
                x
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Name & Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Marker Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Start sleeve shaping"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row Range - "At the Same Time" */}
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <h4 className="font-medium text-purple-800 dark:text-purple-300 mb-3">
                  Row Range ("At the Same Time")
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                      Start Row
                    </label>
                    <input
                      type="number"
                      value={formData.startRow}
                      onChange={(e) => setFormData({ ...formData, startRow: e.target.value })}
                      placeholder="e.g., 45"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                      End Row
                    </label>
                    <input
                      type="number"
                      value={formData.endRow}
                      onChange={(e) => setFormData({ ...formData, endRow: e.target.value })}
                      placeholder="e.g., 80"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                {/* Repeating */}
                <div className="mt-3 flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isRepeating}
                      onChange={(e) => setFormData({ ...formData, isRepeating: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Repeat every</span>
                  </label>
                  {formData.isRepeating && (
                    <input
                      type="number"
                      value={formData.repeatInterval}
                      onChange={(e) => setFormData({ ...formData, repeatInterval: e.target.value })}
                      placeholder="N"
                      className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white"
                    />
                  )}
                  {formData.isRepeating && (
                    <span className="text-sm text-gray-700 dark:text-gray-300">rows</span>
                  )}
                </div>
              </div>

              {/* Counter (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Linked Counter (optional)
                </label>
                <select
                  value={formData.counterId}
                  onChange={(e) => setFormData({ ...formData, counterId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">No specific counter</option>
                  {counters.map((counter) => (
                    <option key={counter.id} value={counter.id}>
                      {counter.name} (current: {counter.current_value})
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority & Display Style */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Display Style
                  </label>
                  <select
                    value={formData.displayStyle}
                    onChange={(e) => setFormData({ ...formData, displayStyle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                  >
                    {DISPLAY_STYLES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Alert Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alert Message *
                </label>
                <textarea
                  value={formData.alertMessage}
                  onChange={(e) => setFormData({ ...formData, alertMessage: e.target.value })}
                  placeholder="e.g., AT THE SAME TIME: Begin armhole shaping - BO 4 sts at beg of next 2 rows"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Alert Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alert Type
                </label>
                <select
                  value={formData.alertType}
                  onChange={(e) => setFormData({ ...formData, alertType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                >
                  {ALERT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
                >
                  Create Marker
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
