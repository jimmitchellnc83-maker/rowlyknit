// @ts-nocheck
import { useState, useEffect } from 'react';
import { FiPlus, FiLink, FiClock } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import CounterCard from './CounterCard';
import CounterForm from './CounterForm';
import CounterHistory from './CounterHistory';
import LinkCounterModal from './LinkCounterModal';
import type { Counter } from '../../types/counter.types';

interface CounterManagerProps {
  projectId: string;
}

export default function CounterManager({ projectId }: CounterManagerProps) {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCounterSelector, setShowCounterSelector] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editingCounter, setEditingCounter] = useState<Counter | null>(null);
  const [selectedCounter, setSelectedCounter] = useState<Counter | null>(null);

  useEffect(() => {
    fetchCounters();
  }, [projectId]);

  const fetchCounters = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/projects/${projectId}/counters`);
      setCounters(response.data.data.counters.sort((a: Counter, b: Counter) => a.sort_order - b.sort_order));
    } catch (error) {
      console.error('Error fetching counters:', error);
      toast.error('Failed to load counters');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCounter = async (counterData: Partial<Counter>) => {
    try {
      const maxSortOrder = counters.length > 0
        ? Math.max(...counters.map(c => c.sort_order))
        : 0;

      await axios.post(`/api/projects/${projectId}/counters`, {
        ...counterData,
        sortOrder: maxSortOrder + 1
      });

      toast.success('Counter created!');
      setShowForm(false);
      fetchCounters();
    } catch (error) {
      console.error('Error creating counter:', error);
      toast.error('Failed to create counter');
    }
  };

  const handleUpdateCounter = async (counterId: string, counterData: Partial<Counter>) => {
    try {
      await axios.put(`/api/projects/${projectId}/counters/${counterId}`, counterData);
      toast.success('Counter updated!');
      setShowForm(false);
      setEditingCounter(null);
      fetchCounters();
    } catch (error) {
      console.error('Error updating counter:', error);
      toast.error('Failed to update counter');
    }
  };

  const handleDeleteCounter = async (counterId: string) => {
    try {
      await axios.delete(`/api/projects/${projectId}/counters/${counterId}`);
      toast.success('Counter deleted!');
      fetchCounters();
    } catch (error) {
      console.error('Error deleting counter:', error);
      toast.error('Failed to delete counter');
    }
  };

  const handleToggleVisibility = async (counterId: string) => {
    const counter = counters.find(c => c.id === counterId);
    if (!counter) return;

    try {
      await axios.put(`/api/projects/${projectId}/counters/${counterId}`, {
        is_visible: !counter.is_visible
      });
      fetchCounters();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error('Failed to update counter');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleReorderCounters = async (_reorderedCounters: Counter[]) => {
    try {
      const updates = _reorderedCounters.map((counter, index) => ({
        id: counter.id,
        sort_order: index
      }));

      await axios.patch(`/api/projects/${projectId}/counters/reorder`, {
        counters: updates
      });

      setCounters(_reorderedCounters);
    } catch (error) {
      console.error('Error reordering counters:', error);
      toast.error('Failed to reorder counters');
      fetchCounters(); // Revert on error
    }
  };

  const visibleCounters = counters.filter(c => c.is_visible && c.is_active);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Counters</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCounterSelector(true)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition flex items-center gap-2"
          >
            <FiClock className="h-4 w-4" />
            History
          </button>
          <button
            onClick={() => setShowLinkModal(true)}
            className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition flex items-center gap-2"
          >
            <FiLink className="h-4 w-4" />
            Link Counters
          </button>
          <button
            onClick={() => {
              setEditingCounter(null);
              setShowForm(true);
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition flex items-center gap-2"
          >
            <FiPlus className="h-4 w-4" />
            Add Counter
          </button>
        </div>
      </div>

      {/* Counter Grid */}
      {visibleCounters.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500 mb-4">No counters yet. Add your first counter to get started!</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition inline-flex items-center gap-2"
          >
            <FiPlus className="h-5 w-5" />
            Add Counter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleCounters.map((counter) => (
            <CounterCard
              key={counter.id}
              counter={counter}
              onUpdate={fetchCounters}
              onEdit={(counter) => {
                setEditingCounter(counter);
                setShowForm(true);
              }}
              onDelete={handleDeleteCounter}
              onToggleVisibility={handleToggleVisibility}
            />
          ))}
        </div>
      )}

      {/* Hidden Counters */}
      {counters.filter(c => !c.is_visible && c.is_active).length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
            Show hidden counters ({counters.filter(c => !c.is_visible).length})
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4 opacity-50">
            {counters.filter(c => !c.is_visible && c.is_active).map((counter) => (
              <CounterCard
                key={counter.id}
                counter={counter}
                onUpdate={fetchCounters}
                onEdit={(counter) => {
                  setEditingCounter(counter);
                  setShowForm(true);
                }}
                onDelete={handleDeleteCounter}
                onToggleVisibility={handleToggleVisibility}
              />
            ))}
          </div>
        </details>
      )}

      {/* Counter Form Modal */}
      {showForm && (
        <CounterForm
          projectId={projectId}
          counter={editingCounter}
          onSave={(data) => {
            if (editingCounter) {
              handleUpdateCounter(editingCounter.id, data);
            } else {
              handleCreateCounter(data);
            }
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingCounter(null);
          }}
        />
      )}

      {/* Counter Selector Modal for History */}
      {showCounterSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiClock className="h-5 w-5" />
                Select Counter for History
              </h3>
              <button
                onClick={() => setShowCounterSelector(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto">
              {counters.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No counters available</p>
              ) : (
                <div className="space-y-2">
                  {counters.map((counter) => (
                    <button
                      key={counter.id}
                      onClick={() => {
                        setSelectedCounter(counter);
                        setShowCounterSelector(false);
                        setShowHistory(true);
                      }}
                      className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-purple-50 rounded-lg transition flex items-center justify-between group"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{counter.name}</div>
                        <div className="text-sm text-gray-500">
                          Current: {counter.current_value}
                          {counter.target_value && ` / ${counter.target_value}`}
                        </div>
                      </div>
                      <FiClock className="h-5 w-5 text-gray-400 group-hover:text-purple-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowCounterSelector(false)}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Counter History Modal */}
      {showHistory && selectedCounter && (
        <CounterHistory
          counter={selectedCounter}
          onClose={() => {
            setShowHistory(false);
            setSelectedCounter(null);
          }}
          onUpdate={fetchCounters}
        />
      )}

      {/* Link Counter Modal */}
      {showLinkModal && (
        <LinkCounterModal
          projectId={projectId}
          counters={counters}
          onClose={() => setShowLinkModal(false)}
          onSave={() => {
            setShowLinkModal(false);
            fetchCounters();
          }}
        />
      )}
    </div>
  );
}
