import { useState, useEffect } from 'react';
import { FiX, FiLink, FiTrash2 } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import type { Counter, CounterLink } from '../../types/counter.types';

interface LinkCounterModalProps {
  projectId: string;
  counters: Counter[];
  onClose: () => void;
  onSave: () => void;
}

export default function LinkCounterModal({ projectId, counters, onClose/*, onSave */ }: LinkCounterModalProps) {
  const [links, setLinks] = useState<CounterLink[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [sourceCounterId, setSourceCounterId] = useState('');
  const [targetCounterId, setTargetCounterId] = useState('');
  const [linkType, setLinkType] = useState<'reset_on_target' | 'advance_together' | 'conditional'>('reset_on_target');
  const [triggerOperator, setTriggerOperator] = useState<'equals' | 'greater_than' | 'less_than'>('equals');
  const [triggerValue, setTriggerValue] = useState('');
  const [actionType, setActionType] = useState<'reset' | 'increment' | 'set'>('reset');
  const [actionValue, setActionValue] = useState('');

  useEffect(() => {
    fetchLinks();
  }, [projectId]);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/projects/${projectId}/counter-links`);
      setLinks(response.data.data.links);
    } catch (error) {
      console.error('Error fetching links:', error);
      toast.error('Failed to load counter links');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sourceCounterId || !targetCounterId) {
      toast.error('Please select both source and target counters');
      return;
    }

    if (sourceCounterId === targetCounterId) {
      toast.error('Cannot link a counter to itself');
      return;
    }

    try {
      // Backend expects camelCase field names
      const linkData: any = {
        sourceCounterId: sourceCounterId,
        targetCounterId: targetCounterId,
        linkType: linkType,
        isActive: true,
      };

      if (linkType === 'reset_on_target' || linkType === 'conditional') {
        linkData.triggerCondition = {
          type: triggerOperator,
          value: Number(triggerValue),
        };

        linkData.action = {
          type: actionType,
          value: actionType === 'reset' || actionType === 'set' ? Number(actionValue) : undefined,
        };
      }

      await axios.post(`/api/projects/${projectId}/counter-links`, linkData);
      toast.success('Counter link created!');

      // Reset form
      setSourceCounterId('');
      setTargetCounterId('');
      setTriggerValue('');
      setActionValue('');

      fetchLinks();
    } catch (error: any) {
      console.error('Error creating link:', error);
      const message = error.response?.data?.message || 'Failed to create link';
      toast.error(message);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      await axios.delete(`/api/projects/${projectId}/counter-links/${linkId}`);
      toast.success('Link deleted!');
      fetchLinks();
    } catch (error) {
      console.error('Error deleting link:', error);
      toast.error('Failed to delete link');
    }
  };

  const getCounterName = (counterId: string) => {
    return counters.find(c => c.id === counterId)?.name || 'Unknown';
  };

  const describeLinkType = (link: CounterLink) => {
    const source = getCounterName(link.source_counter_id);
    const target = getCounterName(link.target_counter_id);

    switch (link.link_type) {
      case 'reset_on_target':
        return `When ${source} ${link.trigger_condition?.type} ${link.trigger_condition?.value}, reset ${target} to ${link.action?.value}`;
      case 'conditional':
        return `When ${source} ${link.trigger_condition?.type} ${link.trigger_condition?.value}, ${link.action?.type} ${target}`;
      case 'advance_together':
        return `${source} and ${target} advance together`;
      default:
        return 'Unknown link type';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Link Counters</h2>
            <p className="text-sm text-gray-500">Create automatic counter relationships</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Create Link Form */}
          <form onSubmit={handleCreateLink} className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Create New Link</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source Counter
                  </label>
                  <select
                    value={sourceCounterId}
                    onChange={(e) => setSourceCounterId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                    required
                  >
                    <option value="">Select counter...</option>
                    {counters.map((counter) => (
                      <option key={counter.id} value={counter.id}>
                        {counter.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Counter
                  </label>
                  <select
                    value={targetCounterId}
                    onChange={(e) => setTargetCounterId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                    required
                  >
                    <option value="">Select counter...</option>
                    {counters.map((counter) => (
                      <option key={counter.id} value={counter.id}>
                        {counter.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Link Type</label>
                <select
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                >
                  <option value="reset_on_target">Reset on Target</option>
                  <option value="conditional">Conditional Action</option>
                  <option value="advance_together">Advance Together</option>
                </select>
              </div>

              {(linkType === 'reset_on_target' || linkType === 'conditional') && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Trigger Condition
                      </label>
                      <select
                        value={triggerOperator}
                        onChange={(e) => setTriggerOperator(e.target.value as any)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                      >
                        <option value="equals">Equals (=)</option>
                        <option value="greater_than">Greater than (&gt;)</option>
                        <option value="less_than">Less than (&lt;)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Trigger Value
                      </label>
                      <input
                        type="number"
                        value={triggerValue}
                        onChange={(e) => setTriggerValue(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                        placeholder="e.g., 8"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Action Type
                      </label>
                      <select
                        value={actionType}
                        onChange={(e) => setActionType(e.target.value as any)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                      >
                        <option value="reset">Reset to value</option>
                        <option value="set">Set to value</option>
                        <option value="increment">Increment</option>
                      </select>
                    </div>

                    {(actionType === 'reset' || actionType === 'set') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Action Value
                        </label>
                        <input
                          type="number"
                          value={actionValue}
                          onChange={(e) => setActionValue(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                          placeholder="e.g., 1"
                          required
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              <button
                type="submit"
                className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
              >
                <FiLink className="h-4 w-4" />
                Create Link
              </button>
            </div>
          </form>

          {/* Existing Links */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Existing Links</h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : links.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No links created yet
              </div>
            ) : (
              <div className="space-y-2">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-sm transition"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FiLink className="h-4 w-4 text-purple-600" />
                        <span className="text-sm text-gray-900">{describeLinkType(link)}</span>
                      </div>
                      {!link.is_active && (
                        <span className="text-xs text-yellow-600">Inactive</span>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        if (confirm('Delete this link?')) {
                          handleDeleteLink(link.id);
                        }
                      }}
                      className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
