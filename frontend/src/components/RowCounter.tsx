import { useState, useEffect, useRef, useCallback } from 'react';
import { FiPlus, FiMinus, FiRefreshCw, FiMic, FiMicOff } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useWebSocket } from '../contexts/WebSocketContext';
import ConfirmModal from './ConfirmModal';

interface RowCounterProps {
  counter: {
    id: string;
    name: string;
    current_count: number;
    target_count: number | null;
    project_id: string;
  };
  onUpdate: () => void;
}

export default function RowCounter({ counter, onUpdate }: RowCounterProps) {
  const [count, setCount] = useState(counter.current_count);
  const [isListening, setIsListening] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isListeningRef = useRef(false);
  const { isConnected, emitCounterIncrement, emitCounterDecrement, emitCounterReset, onCounterUpdate, offCounterUpdate } = useWebSocket();

  // Keep ref in sync so voice callbacks always see latest value
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    setCount(counter.current_count);
  }, [counter.current_count]);

  // Listen for real-time updates from other clients
  useEffect(() => {
    const handleCounterUpdate = (data: { counterId: string; projectId: string; currentValue: number }) => {
      if (data.counterId === counter.id) {
        setCount(data.currentValue);
        toast.info(`Counter updated to ${data.currentValue}`, { autoClose: 1000 });
      }
    };

    onCounterUpdate(handleCounterUpdate);

    return () => {
      offCounterUpdate(handleCounterUpdate);
    };
  }, [counter.id, onCounterUpdate, offCounterUpdate]);

  const updateCountOnServer = useCallback(async (newCount: number) => {
    try {
      await axios.put(`/api/projects/${counter.project_id}/counters/${counter.id}`, {
        currentValue: newCount,
      });
      onUpdate();
    } catch (error) {
      console.error('Error updating counter:', error);
      toast.error('Failed to update counter');
      setCount(counter.current_count);
    }
  }, [counter.project_id, counter.id, counter.current_count, onUpdate]);

  const handleIncrement = useCallback(() => {
    setCount(prevCount => {
      const newCount = prevCount + 1;
      updateCountOnServer(newCount);
      emitCounterIncrement(counter.id, counter.project_id, newCount);
      return newCount;
    });
    playFeedbackSound('increment');
  }, [updateCountOnServer, emitCounterIncrement, counter.id, counter.project_id]);

  const handleDecrement = useCallback(() => {
    setCount(prevCount => {
      if (prevCount > 0) {
        const newCount = prevCount - 1;
        updateCountOnServer(newCount);
        emitCounterDecrement(counter.id, counter.project_id, newCount);
        playFeedbackSound('decrement');
        return newCount;
      }
      return prevCount;
    });
  }, [updateCountOnServer, emitCounterDecrement, counter.id, counter.project_id]);

  const handleReset = useCallback(() => {
    setCount(0);
    updateCountOnServer(0);
    emitCounterReset(counter.id, counter.project_id);
    setShowResetConfirm(false);
    toast.success('Counter reset');
  }, [updateCountOnServer, emitCounterReset, counter.id, counter.project_id]);

  // Store handlers in refs so voice recognition always sees latest versions
  const handleIncrementRef = useRef(handleIncrement);
  const handleDecrementRef = useRef(handleDecrement);
  const handleResetRef = useRef(handleReset);
  useEffect(() => { handleIncrementRef.current = handleIncrement; }, [handleIncrement]);
  useEffect(() => { handleDecrementRef.current = handleDecrement; }, [handleDecrement]);
  useEffect(() => { handleResetRef.current = handleReset; }, [handleReset]);

  const playFeedbackSound = (type: 'increment' | 'decrement') => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const audioContext = audioContextRef.current;

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

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
  };

  // Voice control setup -- created once, uses refs to avoid stale closures
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
        handleIncrementRef.current();
        toast.success('Row added!', { autoClose: 800 });
      } else if (command.includes('back') || command.includes('minus') || command.includes('undo')) {
        handleDecrementRef.current();
        toast.info('Row removed!', { autoClose: 800 });
      } else if (command.includes('reset')) {
        handleResetRef.current();
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        toast.error(`Voice error: ${event.error}`, { autoClose: 2000 });
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setIsListening(false);
          isListeningRef.current = false;
        }
      }
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening (use ref to avoid stale closure)
      if (isListeningRef.current) {
        setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch {
              setIsListening(false);
              isListeningRef.current = false;
            }
          }
        }, 100);
      }
    };

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch { /* ignore */ }
      }
      isListeningRef.current = false;
    };
  }, []); // Created once -- handlers accessed via refs

  // Start/stop recognition when isListening changes
  useEffect(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      try { recognitionRef.current.start(); } catch { /* already started */ }
    } else {
      try { recognitionRef.current.stop(); } catch { /* already stopped */ }
    }
  }, [isListening]);

  const toggleVoiceControl = () => {
    if (!recognitionRef.current) {
      toast.error('Voice control not supported in this browser');
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
        toast.success('Voice control activated! Say "next", "back", or "reset"');
      } catch (e) {
        console.error('Error starting recognition:', e);
        toast.error('Failed to start voice control');
      }
    }
  };

  const progress = counter.target_count ? (count / counter.target_count) * 100 : 0;

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-gradient-to-br from-purple-50 to-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{counter.name}</h3>
        <button
          onClick={toggleVoiceControl}
          className={`p-2 rounded-lg transition ${
            isListening
              ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title={isListening ? 'Stop voice control' : 'Start voice control'}
        >
          {isListening ? <FiMic className="h-5 w-5" /> : <FiMicOff className="h-5 w-5" />}
        </button>
      </div>

      {/* Counter Display */}
      <div className="text-center mb-6">
        <div className="text-6xl font-bold text-purple-600 mb-2">{count}</div>
        {counter.target_count && (
          <p className="text-sm text-gray-500">of {counter.target_count} rows</p>
        )}
      </div>

      {/* Progress Bar */}
      {counter.target_count && (
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-purple-600 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 text-center mt-1">{Math.round(progress)}% complete</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleDecrement}
          disabled={count === 0}
          className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300 text-gray-700 rounded-lg font-semibold transition flex items-center justify-center gap-2"
        >
          <FiMinus className="h-5 w-5" />
          -1
        </button>

        <button
          onClick={() => setShowResetConfirm(true)}
          className="p-3 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg transition"
          title="Reset counter"
        >
          <FiRefreshCw className="h-5 w-5" />
        </button>

        <button
          onClick={handleIncrement}
          className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
        >
          <FiPlus className="h-5 w-5" />
          +1
        </button>
      </div>

      {/* Real-time indicator */}
      {isConnected && (
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-green-600">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Live sync enabled
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <ConfirmModal
          title="Reset Counter"
          message={`Reset "${counter.name}" to 0?`}
          confirmLabel="Reset"
          variant="warning"
          onConfirm={handleReset}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </div>
  );
}
