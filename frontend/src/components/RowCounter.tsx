import { useState, useEffect, useRef } from 'react';
import { FiPlus, FiMinus, FiRefreshCw, FiMic, FiMicOff } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useWebSocket } from '../contexts/WebSocketContext';

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
  const recognitionRef = useRef<any>(null);
  const { isConnected, emitCounterIncrement, emitCounterDecrement, emitCounterReset, onCounterUpdate, offCounterUpdate } = useWebSocket();

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

  const updateCountOnServer = async (newCount: number) => {
    try {
      await axios.put(`/api/projects/${counter.project_id}/counters/${counter.id}`, {
        current_count: newCount,
      });
      onUpdate();
    } catch (error) {
      console.error('Error updating counter:', error);
      toast.error('Failed to update counter');
      // Revert to previous count
      setCount(counter.current_count);
    }
  };

  const handleIncrement = () => {
    const newCount = count + 1;
    setCount(newCount);
    updateCountOnServer(newCount);
    emitCounterIncrement(counter.id, counter.project_id, newCount);

    // Play audio feedback
    playFeedbackSound('increment');
  };

  const handleDecrement = () => {
    if (count > 0) {
      const newCount = count - 1;
      setCount(newCount);
      updateCountOnServer(newCount);
      emitCounterDecrement(counter.id, counter.project_id, newCount);
      playFeedbackSound('decrement');
    }
  };

  const handleReset = async () => {
    if (confirm(`Reset "${counter.name}" to 0?`)) {
      setCount(0);
      updateCountOnServer(0);
      emitCounterReset(counter.id, counter.project_id);
      toast.success('Counter reset');
    }
  };

  const playFeedbackSound = (type: 'increment' | 'decrement') => {
    // Create a simple beep using Web Audio API
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
  };

  // Voice control setup
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

        console.log('Voice command:', command);

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
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          toast.error('Voice control error: ' + event.error);
          setIsListening(false);
        }
      };

      recognitionRef.current.onend = () => {
        if (isListening) {
          // Restart if we're still supposed to be listening
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
          onClick={handleReset}
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
    </div>
  );
}
