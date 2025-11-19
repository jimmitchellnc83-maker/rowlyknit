import { useState, useEffect, useRef, useCallback } from 'react';
import { FiPlus, FiMinus, FiRefreshCw, FiMic, FiMicOff, FiMoreVertical, FiEye, FiEyeOff } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { preventDoubleTap } from '../../utils/debounce';
import type { Counter } from '../../types/counter.types';

interface CounterCardProps {
  counter: Counter;
  onUpdate: () => void;
  onEdit?: (counter: Counter) => void;
  onDelete?: (counterId: string) => void;
  onToggleVisibility?: (counterId: string) => void;
}

export default function CounterCard({ counter, onUpdate: _onUpdate, onEdit, onDelete, onToggleVisibility }: CounterCardProps) {
  const [count, setCount] = useState(counter.current_value);
  const [isListening, setIsListening] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const recognitionRef = useRef<any>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Swipe gesture state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

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
      // Don't call onUpdate() here to prevent unnecessary re-renders and screen blink
      // Counter updates are handled by:
      // 1. Optimistic local state update (setCount)
      // 2. WebSocket real-time sync for multi-device updates
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

  const handleIncrementInternal = () => {
    const increment = calculateIncrement();

    // Use functional setState to avoid stale closure issues with rapid voice commands
    setCount(prevCount => {
      const newCount = prevCount + increment;

      // Check max_value constraint
      if (counter.max_value && newCount > counter.max_value) {
        toast.warning(`Cannot exceed maximum value of ${counter.max_value}`);
        return prevCount; // Don't update if exceeds max
      }

      // Update server and emit WebSocket event with new value
      updateCountOnServer(newCount);
      emitCounterIncrement(counter.id, counter.project_id, newCount);

      return newCount;
    });

    playFeedbackSound('increment');
    triggerHaptic('light');
  };

  const handleDecrementInternal = () => {
    const increment = calculateIncrement();

    // Use functional setState to avoid stale closure issues
    setCount(prevCount => {
      const newCount = prevCount - increment;

      // Check min_value constraint
      if (newCount < counter.min_value) {
        toast.warning(`Cannot go below minimum value of ${counter.min_value}`);
        return prevCount; // Don't update if below min
      }

      // Update server and emit WebSocket event with new value
      updateCountOnServer(newCount);
      emitCounterDecrement(counter.id, counter.project_id, newCount);

      return newCount;
    });

    playFeedbackSound('decrement');
    triggerHaptic('light');
  };

  // Debounced versions to prevent double-taps (button clicks only)
  const handleIncrement = useCallback(preventDoubleTap(handleIncrementInternal, 500), [count, counter]);
  const handleDecrement = useCallback(preventDoubleTap(handleDecrementInternal, 500), [count, counter]);

  // Voice command handlers - NO debouncing for responsive voice control
  const handleVoiceIncrement = () => {
    console.log('[Voice] Increment command received');
    handleIncrementInternal();
    toast.success('Row added! 🎤', { autoClose: 800 });
  };

  const handleVoiceDecrement = () => {
    console.log('[Voice] Decrement command received');
    handleDecrementInternal();
    toast.info('Row removed! 🎤', { autoClose: 800 });
  };

  const handleResetInternal = async () => {
    if (confirm(`Reset "${counter.name}" to ${counter.min_value}?`)) {
      const resetValue = counter.min_value;
      setCount(resetValue);
      updateCountOnServer(resetValue);
      emitCounterReset(counter.id, counter.project_id);
      triggerHaptic('medium');
      toast.success('Counter reset');
    }
  };

  // Debounced reset to prevent accidental double-taps
  const handleReset = useCallback(preventDoubleTap(handleResetInternal, 500), [count, counter]);

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      // Swipe left = increment
      handleIncrement();
    }

    if (isRightSwipe) {
      // Swipe right = decrement
      handleDecrement();
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

  // Voice control with improved responsiveness
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();

      // Optimized settings for knitting counter voice control
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.maxAlternatives = 1; // Faster processing with single best result

      recognitionRef.current.onresult = (event: any) => {
        const last = event.results.length - 1;
        const command = event.results[last][0].transcript.toLowerCase().trim();
        const confidence = event.results[last][0].confidence;

        console.log(`[Voice] Recognized: "${command}" (confidence: ${(confidence * 100).toFixed(0)}%)`);

        // Process voice commands immediately without debouncing
        if (command.includes('next') || command.includes('plus') || command.includes('add')) {
          handleVoiceIncrement();
        } else if (command.includes('back') || command.includes('minus') || command.includes('undo')) {
          handleVoiceDecrement();
        } else if (command.includes('reset')) {
          console.log('[Voice] Reset command received');
          handleReset();
        } else {
          console.log(`[Voice] Unrecognized command: "${command}"`);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('[Voice] Recognition error:', event.error);

        // Only show error toast for actual errors, not normal events
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          toast.error(`Voice error: ${event.error}`, { autoClose: 2000 });

          // Stop listening on serious errors
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setIsListening(false);
          }
        }
      };

      recognitionRef.current.onstart = () => {
        console.log('[Voice] Recognition started');
      };

      recognitionRef.current.onend = () => {
        console.log('[Voice] Recognition ended, isListening:', isListening);

        // Auto-restart if still supposed to be listening
        if (isListening) {
          try {
            // Small delay before restart to prevent rapid cycling
            setTimeout(() => {
              if (isListening && recognitionRef.current) {
                recognitionRef.current.start();
                console.log('[Voice] Recognition restarted');
              }
            }, 100);
          } catch (e) {
            console.error('[Voice] Error restarting recognition:', e);
            setIsListening(false);
          }
        }
      };
    }

    return () => {
      if (recognitionRef.current && isListening) {
        try {
          recognitionRef.current.stop();
          console.log('[Voice] Recognition stopped (cleanup)');
        } catch (e) {
          console.error('[Voice] Error stopping recognition:', e);
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
      ref={cardRef}
      className="border-2 rounded-xl p-4 md:p-6 bg-gradient-to-br from-white to-gray-50 shadow-sm hover:shadow-md transition-shadow select-none"
      style={{ borderColor: counter.display_color }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: counter.display_color }}
          />
          <h3 className="font-semibold text-lg md:text-base text-gray-900">{counter.name}</h3>
          <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded-full whitespace-nowrap">
            {counter.type}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={toggleVoiceControl}
            className={`p-3 md:p-2 rounded-lg transition min-w-[48px] min-h-[48px] md:min-w-0 md:min-h-0 flex items-center justify-center ${
              isListening
                ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={isListening ? 'Stop voice control' : 'Start voice control'}
            aria-label={isListening ? 'Stop voice control' : 'Start voice control'}
            aria-pressed={isListening}
          >
            {isListening ? <FiMic className="h-5 w-5 md:h-4 md:w-4" aria-hidden="true" /> : <FiMicOff className="h-5 w-5 md:h-4 md:w-4" aria-hidden="true" />}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-3 md:p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition min-w-[48px] min-h-[48px] md:min-w-0 md:min-h-0 flex items-center justify-center"
            >
              <FiMoreVertical className="h-5 w-5 md:h-4 md:w-4" />
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
          className="text-6xl md:text-7xl font-bold mb-2 tabular-nums"
          style={{ color: counter.display_color }}
          role="status"
          aria-live="polite"
          aria-label={`Current count: ${count}`}
        >
          {count}
        </div>
        {counter.target_value && (
          <p className="text-base md:text-sm text-gray-500" aria-label={`Target: ${counter.target_value}`}>
            of {counter.target_value}
          </p>
        )}
        {counter.increment_pattern && counter.increment_pattern.description && (
          <p className="text-sm md:text-xs text-gray-400 mt-1">{counter.increment_pattern.description}</p>
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

      {/* Controls - Large Touch Targets (80px mobile, 64px desktop) */}
      <div className="flex items-center gap-2 md:gap-3" role="group" aria-label="Counter controls">
        <button
          onClick={handleDecrement}
          disabled={count <= counter.min_value}
          className="flex-1 h-20 md:h-16 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 disabled:bg-gray-50 disabled:text-gray-300 text-gray-700 rounded-xl font-semibold transition flex items-center justify-center gap-2 text-xl md:text-lg touch-manipulation"
          aria-label={`Decrease ${counter.name} by ${increment}`}
          aria-disabled={count <= counter.min_value}
        >
          <FiMinus className="h-7 w-7 md:h-6 md:w-6" aria-hidden="true" />
          <span className="hidden sm:inline">-{increment}</span>
        </button>

        <button
          onClick={handleReset}
          className="h-20 md:h-16 w-20 md:w-16 flex-shrink-0 bg-yellow-100 hover:bg-yellow-200 active:bg-yellow-300 text-yellow-700 rounded-xl transition flex items-center justify-center touch-manipulation"
          title="Reset counter"
          aria-label={`Reset ${counter.name} to ${counter.min_value}`}
        >
          <FiRefreshCw className="h-7 w-7 md:h-6 md:w-6" aria-hidden="true" />
        </button>

        <button
          onClick={handleIncrement}
          className="flex-1 h-20 md:h-16 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2 text-xl md:text-lg touch-manipulation"
          style={{
            backgroundColor: counter.display_color
          }}
          aria-label={`Increase ${counter.name} by ${increment}`}
        >
          <FiPlus className="h-7 w-7 md:h-6 md:w-6" aria-hidden="true" />
          <span className="hidden sm:inline">+{increment}</span>
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
