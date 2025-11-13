import { useState, useEffect } from 'react';
import { FiAlertCircle, FiPlus, FiEdit2, FiTrash2, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
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
}

const TRIGGER_TYPES = [
  { value: 'counter_value', label: 'Counter reaches value' },
  { value: 'row_interval', label: 'Every N rows' },
  { value: 'stitch_count', label: 'Stitch count milestone' },
  { value: 'time_based', label: 'Time-based reminder' },
];

const ALERT_TYPES = [
  { value: 'notification', label: '🔔 Notification' },
  { value: 'sound', label: '🔊 Sound' },
  { value: 'vibration', label: '📳 Vibration' },
  { value: 'visual', label: '✨ Visual' },
];

export default function MagicMarkerManager({ projectId, counters }: MagicMarkerManagerProps) {
  const [markers, setMarkers] = useState<MagicMarker[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingMarker, setEditingMarker] = useState<MagicMarker | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    counterId: '',
    triggerType: 'counter_value',
    triggerValue: '',
    interval: '',
    alertMessage: '',
    alertType: 'notification',
  });

  useEffect(() => {
    fetchMarkers();
  }, [projectId]);

  const fetchMarkers = async () => {
    try {
      const response = await axios.get(`/api/projects/${projectId}/magic-markers`);
      setMarkers(response.data.data.magicMarkers || []);
    } catch (error) {
      console.error('Error fetching magic markers:', error);
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
      triggerType: 'counter_value',
      triggerValue: '',
      interval: '',
      alertMessage: '',
      alertType: 'notification',
    });
  };

  const getTriggerDescription = (marker: MagicMarker) => {
    const condition = marker.trigger_condition;
    switch (marker.trigger_type) {
      case 'counter_value':
        return `When counter reaches ${condition.value}`;
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

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FiAlertCircle className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Magic Markers</h2>
          <span className="text-sm text-gray-500">({markers.length})</span>
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
      {markers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FiAlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No magic markers yet</p>
          <p className="text-sm mt-1">Create markers to get alerts at important milestones</p>
        </div>
      ) : (
        <div className="space-y-3">
          {markers.map((marker) => (
            <div
              key={marker.id}
              className={`border rounded-lg p-4 ${
                marker.is_active
                  ? 'border-purple-200 bg-purple-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{marker.name}</h3>
                    {marker.is_active ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mb-2">
                    {getTriggerDescription(marker)}
                  </p>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Alert:</span>
                    <span className="text-sm font-medium text-gray-700">
                      {marker.alert_message}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleToggle(marker.id)}
                    className="p-2 hover:bg-white rounded transition"
                    title={marker.is_active ? 'Disable' : 'Enable'}
                  >
                    {marker.is_active ? (
                      <FiToggleRight className="h-5 w-5 text-green-600" />
                    ) : (
                      <FiToggleLeft className="h-5 w-5 text-gray-400" />
                    )}
                  </button>

                  <button
                    onClick={() => handleDelete(marker.id, marker.name)}
                    className="p-2 hover:bg-white rounded transition text-red-600"
                    title="Delete"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">New Magic Marker</h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Marker Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Decrease reminder"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Counter (optional)
                </label>
                <select
                  value={formData.counterId}
                  onChange={(e) => setFormData({ ...formData, counterId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All counters</option>
                  {counters.map((counter) => (
                    <option key={counter.id} value={counter.id}>
                      {counter.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trigger Type
                </label>
                <select
                  value={formData.triggerType}
                  onChange={(e) => setFormData({ ...formData, triggerType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                >
                  {TRIGGER_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {(formData.triggerType === 'counter_value' || formData.triggerType === 'stitch_count') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trigger Value
                  </label>
                  <input
                    type="number"
                    value={formData.triggerValue}
                    onChange={(e) => setFormData({ ...formData, triggerValue: e.target.value })}
                    placeholder="e.g., 100"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}

              {(formData.triggerType === 'row_interval' || formData.triggerType === 'time_based') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {formData.triggerType === 'time_based' ? 'Interval (minutes)' : 'Every N Rows'}
                  </label>
                  <input
                    type="number"
                    value={formData.interval}
                    onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                    placeholder={formData.triggerType === 'time_based' ? 'e.g., 30' : 'e.g., 10'}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alert Message *
                </label>
                <textarea
                  value={formData.alertMessage}
                  onChange={(e) => setFormData({ ...formData, alertMessage: e.target.value })}
                  placeholder="e.g., Time to start decreases for the sleeve!"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alert Type
                </label>
                <select
                  value={formData.alertType}
                  onChange={(e) => setFormData({ ...formData, alertType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                >
                  {ALERT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
