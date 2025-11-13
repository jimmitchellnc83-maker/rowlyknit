import { useState, useEffect, useRef } from 'react';
import { FiPlus, FiMinus, FiRefreshCw, FiMic, FiMicOff, FiMoreVertical, FiEye, FiEyeOff } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useWebSocket } from '../../contexts/WebSocketContext';
import type { Counter } from '../../types/counter.types';

interface CounterCardProps {
  counter: Counter;
  onUpdate: () => void;
  onEdit?: (counter: Counter) => void;
  onDelete?: (counterId: string) => void;
  onToggleVisibility?: (counterId: string) => void;
}

export default function CounterCard({ counter, onUpdate, onEdit, onDelete, onToggleVisibility }: CounterCardProps) {
  const [count, setCount] = useState(counter.current_value);
  const [isListening, setIsListening] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const recognitionRef = useRef<any>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { isConnected, emitCounterIncrement, emitCounterDecrement, emitCounterReset, onCounterUpdate, offCounterUpdate } = useWebSocket();

  useEffect(() => {
    setCount(counter.current_value);
  }, [counter.current_value]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  // Listen for real-time updates
  useEffect(() => {
    const handleCounterUpdate = (data: { counterId: string; projectId: string; currentValue: number }) => {
      if (data.counterId === counter.id) {
        setCount(data.currentValue);
        triggerHaptic('light');
        toast.info(`${counter.name} updated to ${data.currentValue}`, { autoClose: 1000 });
      }
    };

    onCounterUpdate(handleCounterUpdate);
    return () => offCounterUpdate(handleCounterUpdate);
  }, [counter.id, counter.name, onCounterUpdate, offCounterUpdate]);

  // Haptic feedback
  const triggerHaptic = (intensity: 'light' | 'medium' | 'heavy') => {
    if ('vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30, 10, 30]
      };
      navigator.vibrate(patterns[intensity]);
    }
  };

  const updateCountOnServer = async (newValue: number) => {
    try {
      await axios.put(`/api/projects/${counter.project_id}/counters/${counter.id}`, {
        current_value: newValue,
      });
      onUpdate();
    } catch (error) {
      console.error('Error updating counter:', error);
      toast.error('Failed to update counter');
      setCount(counter.current_value);
    }
  };

  const calculateIncrement = (): number => {
    if (!counter.increment_pattern) {
      return counter.increment_by;
    }

    const pattern = counter.increment_pattern;

    switch (pattern.type) {
      case 'simple':
        return counter.increment_by;

      case 'custom_fixed':
        return pattern.increment || counter.increment_by;

      case 'every_n':
        // Increment only every N clicks
        // This would need click tracking - simplified for now
        return pattern.increment || 1;

      default:
        return counter.increment_by;
    }
  };

  const handleIncrement = () => {
    const increment = calculateIncrement();
    const newCount = count + increment;

    // Check max_value constraint
    if (counter.max_value && newCount > counter.max_value) {
      toast.warning(`Cannot exceed maximum value of ${counter.max_value}`);
      return;
    }

    setCount(newCount);
    updateCountOnServer(newCount);
    emitCounterIncrement(counter.id, counter.project_id, newCount);
    playFeedbackSound('increment');
    triggerHaptic('light');
  };

  const handleDecrement = () => {
    const increment = calculateIncrement();
    const newCount = count - increment;

    // Check min_value constraint
    if (newCount < counter.min_value) {
      toast.warning(`Cannot go below minimum value of ${counter.min_value}`);
      return;
    }

    setCount(newCount);
    updateCountOnServer(newCount);
    emitCounterDecrement(counter.id, counter.project_id, newCount);
    playFeedbackSound('decrement');
    triggerHaptic('light');
  };

  const handleReset = async () => {
    if (confirm(`Reset "${counter.name}" to ${counter.min_value}?`)) {
      setCount(counter.min_value);
      updateCountOnServer(counter.min_value);
      emitCounterReset(counter.id, counter.project_id);
      triggerHaptic('medium');
      toast.success('Counter reset');
    }
  };

  const playFeedbackSound = (type: 'increment' | 'decrement') => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = type === 'increment' ? 800 : 600;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.error('Audio feedback error:', error);
    }
  };

  // Voice control
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const last = event.results.length - 1;
        const command = event.results[last][0].transcript.toLowerCase().trim();

        if (command.includes('next') || command.includes('plus') || command.includes('add')) {
          handleIncrement();
          toast.success('Row added! 🎤', { autoClose: 1000 });
        } else if (command.includes('back') || command.includes('minus') || command.includes('undo')) {
          handleDecrement();
          toast.info('Row removed! 🎤', { autoClose: 1000 });
        } else if (command.includes('reset')) {
          handleReset();
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          toast.error('Voice control error');
          setIsListening(false);
        }
      };

      recognitionRef.current.onend = () => {
        if (isListening) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error('Error restarting recognition:', e);
          }
        }
      };
    }

    return () => {
      if (recognitionRef.current && isListening) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error('Error stopping recognition:', e);
        }
      }
    };
  }, [isListening]);

  const toggleVoiceControl = () => {
    if (!recognitionRef.current) {
      toast.error('Voice control not supported in this browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      toast.info('Voice control stopped');
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast.success('Voice control activated!');
      } catch (e) {
        toast.error('Failed to start voice control');
      }
    }
  };

  const progress = counter.target_value ? (count / counter.target_value) * 100 : 0;
  const increment = calculateIncrement();

  return (
    <div
      className="border-2 rounded-xl p-6 bg-gradient-to-br from-white to-gray-50 shadow-sm hover:shadow-md transition-shadow"
      style={{ borderColor: counter.display_color }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: counter.display_color }}
          />
          <h3 className="font-semibold text-gray-900">{counter.name}</h3>
          <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded-full">
            {counter.type}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleVoiceControl}
            className={`p-2 rounded-lg transition ${
              isListening
                ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={isListening ? 'Stop voice control' : 'Start voice control'}
          >
            {isListening ? <FiMic className="h-4 w-4" /> : <FiMicOff className="h-4 w-4" />}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
            >
              <FiMoreVertical className="h-4 w-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                {onEdit && (
                  <button
                    onClick={() => {
                      onEdit(counter);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                  >
                    Edit Counter
                  </button>
                )}
                {onToggleVisibility && (
                  <button
                    onClick={() => {
                      onToggleVisibility(counter.id);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
                  >
                    {counter.is_visible ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                    {counter.is_visible ? 'Hide' : 'Show'}
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${counter.name}"?`)) {
                        onDelete(counter.id);
                      }
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm border-t border-gray-100"
                  >
                    Delete Counter
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Counter Display */}
      <div className="text-center mb-6">
        <div
          className="text-7xl font-bold mb-2 tabular-nums"
          style={{ color: counter.display_color }}
        >
          {count}
        </div>
        {counter.target_value && (
          <p className="text-sm text-gray-500">of {counter.target_value}</p>
        )}
        {counter.increment_pattern && counter.increment_pattern.description && (
          <p className="text-xs text-gray-400 mt-1">{counter.increment_pattern.description}</p>
        )}
      </div>

      {/* Progress Bar */}
      {counter.target_value && (
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${Math.min(progress, 100)}%`,
                backgroundColor: counter.display_color
              }}
            />
          </div>
          <p className="text-xs text-gray-500 text-center mt-1">
            {Math.round(progress)}% complete
          </p>
        </div>
      )}

      {/* Controls - Large Touch Targets (min 60px) */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleDecrement}
          disabled={count <= counter.min_value}
          className="flex-1 h-16 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300 text-gray-700 rounded-xl font-semibold transition flex items-center justify-center gap-2 text-lg"
          style={{ minHeight: '60px' }}
        >
          <FiMinus className="h-6 w-6" />
          -{increment}
        </button>

        <button
          onClick={handleReset}
          className="h-16 px-4 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-xl transition"
          title="Reset counter"
          style={{ minHeight: '60px' }}
        >
          <FiRefreshCw className="h-6 w-6" />
        </button>

        <button
          onClick={handleIncrement}
          className="flex-1 h-16 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2 text-lg"
          style={{
            minHeight: '60px',
            backgroundColor: counter.display_color
          }}
        >
          <FiPlus className="h-6 w-6" />
          +{increment}
        </button>
      </div>

      {/* Notes */}
      {counter.notes && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-700">{counter.notes}</p>
        </div>
      )}

      {/* Real-time indicator */}
      {isConnected && (
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-green-600">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Live sync
        </div>
      )}
    </div>
  );
}
