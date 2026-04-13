import { useState, useEffect, useRef, useCallback } from 'react';
import { FiPlus, FiMinus, FiLink, FiRefreshCw, FiChevronRight, FiChevronDown, FiMic, FiMicOff } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import type { Counter, IncrementMode, CounterUpdateResult } from '../../types/counter.types';
import CounterForm from './CounterForm';

interface CounterHierarchyProps {
  projectId: string;
  onCounterChange?: () => void;
}

interface HierarchicalCounterCardProps {
  counter: Counter;
  isPrimary: boolean;
  mode: IncrementMode;
  onIncrement: (id: string, amount: number) => void;
  onEdit: (counter: Counter) => void;
  onDelete: (id: string) => void;
  loading: boolean;
}

function HierarchicalCounterCard({
  counter,
  isPrimary,
  mode,
  onIncrement,
  onEdit,
  onDelete,
  loading
}: HierarchicalCounterCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const onIncrementRef = useRef(onIncrement);

  // Keep refs current
  useEffect(() => { onIncrementRef.current = onIncrement; }, [onIncrement]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

  // Store counter info in refs so voice handler always sees latest values
  const counterIdRef = useRef(counter.id);
  const incrementByRef = useRef(counter.increment_by || 1);
  useEffect(() => { counterIdRef.current = counter.id; }, [counter.id]);
  useEffect(() => { incrementByRef.current = counter.increment_by || 1; }, [counter.increment_by]);

  // Parse a number from voice command, e.g. "add 3" -> 3, "plus five" -> 5
  const parseAmount = useCallback((command: string, defaultAmount: number): number => {
    const wordNumbers: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
    };
    // Check for digit in command: "add 3", "plus 5"
    const digitMatch = command.match(/\b(\d+)\b/);
    if (digitMatch) return parseInt(digitMatch[1], 10);
    // Check for word numbers: "add three", "minus two"
    for (const [word, num] of Object.entries(wordNumbers)) {
      if (command.includes(word)) return num;
    }
    return defaultAmount;
  }, []);

  // Voice control setup -- created once, uses refs for all mutable values
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const command = event.results[last][0].transcript.toLowerCase().trim();

      if (command.includes('next') || command.includes('plus') || command.includes('add')) {
        const amount = parseAmount(command, incrementByRef.current);
        onIncrementRef.current(counterIdRef.current, amount);
        toast.success(`+${amount} row${amount > 1 ? 's' : ''}`, { autoClose: 800 });
      } else if (command.includes('back') || command.includes('minus') || command.includes('undo') || command.includes('subtract') || command.includes('remove')) {
        const amount = parseAmount(command, 1);
        onIncrementRef.current(counterIdRef.current, -amount);
        toast.info(`-${amount} row${amount > 1 ? 's' : ''}`, { autoClose: 800 });
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        // Don't show toast for transient errors -- just restart
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          toast.error('Microphone access denied', { autoClose: 2000 });
          setIsListening(false);
          isListeningRef.current = false;
        }
      }
    };

    recognition.onend = () => {
      // Always restart if we're supposed to be listening
      if (isListeningRef.current) {
        // Longer delay to avoid rapid cycling that causes the browser to throttle
        setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e: any) {
              // "already started" is fine -- ignore it
              if (!e?.message?.includes('already started')) {
                console.error('Voice restart failed:', e);
                // Don't give up -- try again after a longer delay
                setTimeout(() => {
                  if (isListeningRef.current && recognitionRef.current) {
                    try { recognitionRef.current.start(); } catch { /* give up */ }
                  }
                }, 1000);
              }
            }
          }
        }, 300);
      }
    };

    return () => {
      try { recognition.stop(); } catch { /* ignore */ }
    };
  }, [parseAmount]); // parseAmount is stable (useCallback with no deps)

  const toggleVoice = useCallback(() => {
    if (!recognitionRef.current) {
      toast.error('Voice control not supported');
      return;
    }
    if (isListeningRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      isListeningRef.current = false;
      toast.info('Voice control stopped');
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        isListeningRef.current = true;
        toast.success('Say "next", "add 3", "back 2", etc.');
      } catch {
        toast.error('Failed to start voice control');
      }
    }
  }, []);

  const percentage = counter.target_value
    ? Math.round((counter.current_value / counter.target_value) * 100)
    : null;

  const showButtons = isPrimary || mode === 'independent';
  const hasChildren = counter.children && counter.children.length > 0;

  return (
    <div className={`${isPrimary ? '' : 'ml-6 border-l-2 border-purple-200 dark:border-purple-800 pl-4'}`}>
      <div
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 mb-3 transition-all ${
          isPrimary
            ? 'border-l-4 border-purple-600'
            : 'border-l-2 border-blue-400 dark:border-blue-600'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {hasChildren && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                {expanded ? (
                  <FiChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <FiChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </button>
            )}
            <span className="text-xl">{isPrimary ? '📊' : '🔁'}</span>
            <h3 className="font-semibold text-gray-900 dark:text-white">{counter.name}</h3>
            {counter.auto_reset && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full flex items-center gap-1">
                <FiRefreshCw className="h-3 w-3" />
                Auto-reset
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasChildren && (
              <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                {counter.children!.length} linked
              </span>
            )}
            {showButtons && (
              <button
                onClick={toggleVoice}
                className={`p-1.5 rounded-lg transition ${
                  isListening
                    ? 'bg-red-100 text-red-600 animate-pulse'
                    : 'text-gray-400 hover:text-purple-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={isListening ? 'Stop voice control' : 'Start voice control'}
              >
                {isListening ? <FiMic className="h-4 w-4" /> : <FiMicOff className="h-4 w-4" />}
              </button>
            )}
            <button
              onClick={() => onEdit(counter)}
              className="text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 p-1"
            >
              Edit
            </button>
          </div>
        </div>

        {/* Value Display */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-4xl font-bold text-purple-600 dark:text-purple-400">
            {counter.current_value.toLocaleString()}
          </span>
          {counter.target_value && (
            <>
              <span className="text-2xl text-gray-400">/</span>
              <span className="text-2xl text-gray-500 dark:text-gray-400">
                {counter.target_value.toLocaleString()}
              </span>
            </>
          )}
        </div>

        {/* Progress Bar */}
        {percentage !== null && (
          <div className="mb-4">
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-600 dark:bg-purple-500 transition-all duration-300 ease-out"
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
              {percentage}% complete
            </p>
          </div>
        )}

        {/* Increment/Decrement Buttons */}
        {showButtons && (
          <div className="flex gap-3">
            <button
              onClick={() => onIncrement(counter.id, -1)}
              disabled={loading || counter.current_value <= (counter.min_value || 0)}
              className="flex-1 h-12 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
                       text-gray-700 dark:text-gray-200 rounded-lg transition flex items-center justify-center
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiMinus className="h-6 w-6" />
            </button>
            <button
              onClick={() => onIncrement(counter.id, counter.increment_by || 1)}
              disabled={loading}
              className="flex-1 h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition
                       flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiPlus className="h-6 w-6" />
            </button>
          </div>
        )}

        {/* Non-primary counter in linked mode - show value only */}
        {!showButtons && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
            <FiLink className="inline h-4 w-4 mr-1" />
            Updates with parent counter
          </p>
        )}
      </div>

      {/* Render Children */}
      {expanded && hasChildren && (
        <div className="space-y-2">
          {counter.children!.map((child) => (
            <HierarchicalCounterCard
              key={child.id}
              counter={child}
              isPrimary={false}
              mode={mode}
              onIncrement={onIncrement}
              onEdit={onEdit}
              onDelete={onDelete}
              loading={loading}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CounterHierarchy({ projectId, onCounterChange }: CounterHierarchyProps) {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [allCounters, setAllCounters] = useState<Counter[]>([]);
  const [loading, setLoading] = useState(true);
  const [incrementing, setIncrementing] = useState(false);
  const [mode, setMode] = useState<IncrementMode>('linked');
  const [showForm, setShowForm] = useState(false);
  const [editingCounter, setEditingCounter] = useState<Counter | null>(null);
  const [parentForNewCounter, setParentForNewCounter] = useState<string | null>(null);

  useEffect(() => {
    fetchCounters();
  }, [projectId]);

  const fetchCounters = async () => {
    try {
      setLoading(true);
      // Fetch both flat and hierarchical
      const [hierarchyRes, flatRes] = await Promise.all([
        axios.get(`/api/projects/${projectId}/counters/hierarchy`),
        axios.get(`/api/projects/${projectId}/counters`)
      ]);
      setCounters(hierarchyRes.data.data.counters || []);
      setAllCounters(flatRes.data.data.counters || []);
    } catch (error) {
      console.error('Error fetching counters:', error);
      toast.error('Failed to load counters');
    } finally {
      setLoading(false);
    }
  };

  const handleIncrement = async (counterId: string, amount: number) => {
    try {
      setIncrementing(true);
      const response = await axios.post(
        `/api/projects/${projectId}/counters/${counterId}/increment`,
        { amount, mode }
      );

      if (response.data.success) {
        const updates: CounterUpdateResult[] = response.data.data.updated_counters;

        // Show toast for any resets
        updates
          .filter((u) => u.reset && u.completion_message)
          .forEach((u) => {
            toast.success(u.completion_message, {
              icon: '🎉',
              autoClose: 3000,
            });
          });

        // Refresh counters
        await fetchCounters();
        onCounterChange?.();
      }
    } catch (error) {
      console.error('Error incrementing counter:', error);
      toast.error('Failed to update counter');
    } finally {
      setIncrementing(false);
    }
  };

  const handleCreateCounter = async (counterData: Partial<Counter>) => {
    try {
      await axios.post(`/api/projects/${projectId}/counters`, {
        ...counterData,
        parentCounterId: parentForNewCounter,
      });
      toast.success('Counter created!');
      setShowForm(false);
      setParentForNewCounter(null);
      fetchCounters();
      onCounterChange?.();
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
      onCounterChange?.();
    } catch (error) {
      console.error('Error updating counter:', error);
      toast.error('Failed to update counter');
    }
  };

  const handleDeleteCounter = async (counterId: string) => {
    if (!confirm('Delete this counter? Any linked counters will be unlinked.')) return;
    try {
      await axios.delete(`/api/projects/${projectId}/counters/${counterId}`);
      toast.success('Counter deleted!');
      fetchCounters();
      onCounterChange?.();
    } catch (error) {
      console.error('Error deleting counter:', error);
      toast.error('Failed to delete counter');
    }
  };

  // Filter to show only primary counters (children are nested inside)
  const primaryCounters = counters.filter(
    (c) => !c.parent_counter_id && c.is_visible && c.is_active
  );

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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Counters</h2>
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setMode('linked')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                mode === 'linked'
                  ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <FiLink className="inline h-4 w-4 mr-1" />
              Linked
            </button>
            <button
              onClick={() => setMode('independent')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                mode === 'independent'
                  ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Independent
            </button>
          </div>
          <button
            onClick={() => {
              setEditingCounter(null);
              setParentForNewCounter(null);
              setShowForm(true);
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition flex items-center gap-2"
          >
            <FiPlus className="h-4 w-4" />
            Add Counter
          </button>
        </div>
      </div>

      {/* Mode Description */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400">
        {mode === 'linked' ? (
          <p>
            <FiLink className="inline h-4 w-4 mr-1" />
            <strong>Linked Mode:</strong> Incrementing a parent counter will update all linked child counters together.
            Auto-reset counters will reset when they reach their target.
          </p>
        ) : (
          <p>
            <strong>Independent Mode:</strong> Each counter can be adjusted separately without affecting linked counters.
          </p>
        )}
      </div>

      {/* Counter List */}
      {primaryCounters.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No counters yet. Add your first counter to track your progress!
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition inline-flex items-center gap-2"
          >
            <FiPlus className="h-5 w-5" />
            Add Counter
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {primaryCounters.map((counter) => (
            <div key={counter.id}>
              <HierarchicalCounterCard
                counter={counter}
                isPrimary={true}
                mode={mode}
                onIncrement={handleIncrement}
                onEdit={(c) => {
                  setEditingCounter(c);
                  setShowForm(true);
                }}
                onDelete={handleDeleteCounter}
                loading={incrementing}
              />
              {/* Add Linked Counter Button */}
              <button
                onClick={() => {
                  setEditingCounter(null);
                  setParentForNewCounter(counter.id);
                  setShowForm(true);
                }}
                className="ml-6 mt-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1"
              >
                <FiPlus className="h-4 w-4" />
                Add linked counter
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Counter Form Modal */}
      {showForm && (
        <CounterForm
          projectId={projectId}
          counter={editingCounter}
          parentCounterId={parentForNewCounter}
          existingCounters={allCounters}
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
            setParentForNewCounter(null);
          }}
        />
      )}
    </div>
  );
}
