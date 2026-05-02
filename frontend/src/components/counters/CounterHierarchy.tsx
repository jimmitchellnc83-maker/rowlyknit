import { useState, useEffect, useRef, useCallback } from 'react';
import { FiPlus, FiMinus, FiLink, FiRefreshCw, FiChevronRight, FiChevronDown, FiMic, FiMicOff } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import type { Counter, IncrementMode, CounterUpdateResult } from '../../types/counter.types';
import CounterForm from './CounterForm';
import HelpTooltip from '../HelpTooltip';
import ConfirmModal from '../ConfirmModal';
import ChartRowTracker from './ChartRowTracker';
import type { ChartData } from '../designer/ChartGrid';

interface CounterHierarchyProps {
  projectId: string;
  onCounterChange?: () => void;
  /** When the parent project has a saved Designer chart, pass it here and
   *  the first primary row-type counter will be wired to it — its
   *  current_value drives the chart's highlighted row, and incrementing
   *  the counter advances the row follower. */
  linkedChart?: ChartData | null;
}

interface HierarchicalCounterCardProps {
  counter: Counter;
  isPrimary: boolean;
  mode: IncrementMode;
  onIncrement: (id: string, amount: number) => void;
  onEdit: (counter: Counter) => void;
  onDelete: (id: string) => void;
  loading: boolean;
  isListening: boolean;
  onToggleVoice: () => void;
}

function HierarchicalCounterCard({
  counter,
  isPrimary,
  mode,
  onIncrement,
  onEdit,
  onDelete,
  loading,
  isListening,
  onToggleVoice,
}: HierarchicalCounterCardProps) {
  const [expanded, setExpanded] = useState(true);

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
                onClick={onToggleVoice}
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

        {/* Voice commands reference */}
        {isListening && showButtons && (
          <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-700 dark:text-red-300">
            <div className="flex items-center gap-1 mb-1 font-medium">
              <FiMic className="h-3 w-3 animate-pulse" />
              Listening...
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-red-600 dark:text-red-400">
              <span>"next" / "add" → +1</span>
              <span>"back" / "undo" → -1</span>
              <span>"add 3" → +3</span>
              <span>"back 5" → -5</span>
              <span>"plus ten" → +10</span>
              <span>"subtract two" → -2</span>
            </div>
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
              isListening={false}
              onToggleVoice={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CounterHierarchy({ projectId, onCounterChange, linkedChart }: CounterHierarchyProps) {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [allCounters, setAllCounters] = useState<Counter[]>([]);
  const [loading, setLoading] = useState(true);
  const [incrementing, setIncrementing] = useState(false);
  const [mode, setMode] = useState<IncrementMode>('linked');
  const [showForm, setShowForm] = useState(false);
  const [editingCounter, setEditingCounter] = useState<Counter | null>(null);
  const [parentForNewCounter, setParentForNewCounter] = useState<string | null>(null);
  const [deleteCounterId, setDeleteCounterId] = useState<string | null>(null);

  // Voice control state lives HERE (parent) so it survives child card re-renders
  const [voiceActiveCounterId, setVoiceActiveCounterId] = useState<string | null>(null);
  const voiceRecognitionRef = useRef<any>(null);
  const voiceCounterIdRef = useRef<string | null>(null);
  const handleIncrementRef = useRef<(id: string, amount: number) => void>(() => {});

  // Parse number from voice command
  const parseVoiceAmount = useCallback((command: string, defaultAmount: number): number => {
    const wordNums: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
      eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
    };
    const digitMatch = command.match(/\b(\d+)\b/);
    if (digitMatch) return parseInt(digitMatch[1], 10);
    for (const [word, num] of Object.entries(wordNums)) {
      if (command.includes(word)) return num;
    }
    return defaultAmount;
  }, []);

  // Create recognition once, reuse across all counters
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    voiceRecognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      const last = event.results.length - 1;
      const cmd = event.results[last][0].transcript.toLowerCase().trim();
      const cid = voiceCounterIdRef.current;
      if (!cid) return;

      if (cmd.includes('next') || cmd.includes('plus') || cmd.includes('add')) {
        const amt = parseVoiceAmount(cmd, 1);
        handleIncrementRef.current(cid, amt);
        toast.success(`+${amt} row${amt > 1 ? 's' : ''}`, { autoClose: 800 });
      } else if (cmd.includes('back') || cmd.includes('minus') || cmd.includes('undo') || cmd.includes('subtract') || cmd.includes('remove')) {
        const amt = parseVoiceAmount(cmd, 1);
        handleIncrementRef.current(cid, -amt);
        toast.info(`-${amt} row${amt > 1 ? 's' : ''}`, { autoClose: 800 });
      }
    };

    rec.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        toast.error('Microphone access denied');
        setVoiceActiveCounterId(null);
      }
    };

    rec.onend = () => {
      // Auto-restart if still supposed to be listening
      if (voiceCounterIdRef.current) {
        setTimeout(() => {
          if (voiceCounterIdRef.current && voiceRecognitionRef.current) {
            try { voiceRecognitionRef.current.start(); } catch {
              setTimeout(() => {
                if (voiceCounterIdRef.current && voiceRecognitionRef.current) {
                  try { voiceRecognitionRef.current.start(); } catch { /* give up */ }
                }
              }, 1000);
            }
          }
        }, 300);
      }
    };

    return () => { try { rec.stop(); } catch { /* intentional: recogniser may not be started */ } };
  }, [parseVoiceAmount]);

  const handleToggleVoice = useCallback((counterId: string) => {
    if (!voiceRecognitionRef.current) {
      toast.error('Voice control not supported');
      return;
    }

    if (voiceCounterIdRef.current === counterId) {
      // Stop
      voiceRecognitionRef.current.stop();
      voiceCounterIdRef.current = null;
      setVoiceActiveCounterId(null);
      toast.info('Voice control stopped');
    } else {
      // Stop any existing, start for this counter
      try { voiceRecognitionRef.current.stop(); } catch { /* intentional: recogniser may not be started */ }
      voiceCounterIdRef.current = counterId;
      setVoiceActiveCounterId(counterId);
      setTimeout(() => {
        try {
          voiceRecognitionRef.current.start();
          toast.success('Say "next", "add 3", "back 2", etc.');
        } catch {
          toast.error('Failed to start voice control');
          voiceCounterIdRef.current = null;
          setVoiceActiveCounterId(null);
        }
      }, 100);
    }
  }, []);

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

  // Keep voice ref current so speech recognition always calls latest handler
  handleIncrementRef.current = handleIncrement;

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

  const handleDeleteCounter = (counterId: string) => {
    setDeleteCounterId(counterId);
  };

  const confirmDeleteCounter = async () => {
    if (!deleteCounterId) return;
    const counterId = deleteCounterId;
    setDeleteCounterId(null);
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

  // When a designer chart is attached to the project, auto-wire the first
  // visible primary row-type counter as the chart's row tracker. The
  // backend persists the type as 'rows' (plural) even though the frontend
  // counter.types.ts union claims 'row' (singular) — the earlier singular
  // filter here silently matched nothing. Accept either for safety; cast
  // to string because the narrower TS union doesn't include 'rows'.
  const chartLinkedCounter = linkedChart
    ? primaryCounters.find((c) => {
        const t = c.type as string;
        return t === 'rows' || t === 'row';
      }) ?? null
    : null;

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
          <HelpTooltip text="Linked Mode: Incrementing a parent counter updates all linked children. Independent Mode: Each counter increments separately." />
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

      {/* Chart follower — when the project has a designer chart and a
          primary row-type counter exists, show a read-only chart viewer
          that highlights the current row and exposes its own +/- steppers. */}
      {chartLinkedCounter && linkedChart && (
        <ChartRowTracker
          chart={linkedChart}
          currentRow={chartLinkedCounter.current_value}
          counterName={chartLinkedCounter.name}
          disabled={incrementing}
          onStep={(delta) => handleIncrement(chartLinkedCounter.id, delta)}
        />
      )}

      {/* Counter List */}
      {primaryCounters.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-gray-700 dark:text-gray-200 font-medium mb-1">
            Add a counter to unlock Make Mode
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 mx-auto max-w-md">
            A basic row counter is enough to start — Rowly tracks where you are and steps forward on voice or keyboard.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition inline-flex items-center gap-2"
          >
            <FiPlus className="h-5 w-5" />
            Add row counter
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
                isListening={voiceActiveCounterId === counter.id}
                onToggleVoice={() => handleToggleVoice(counter.id)}
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

      {deleteCounterId && (
        <ConfirmModal
          title="Delete counter"
          message="Delete this counter? Any linked counters will be unlinked. This cannot be undone."
          onConfirm={confirmDeleteCounter}
          onCancel={() => setDeleteCounterId(null)}
        />
      )}
    </div>
  );
}
