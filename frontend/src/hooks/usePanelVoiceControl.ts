import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  matchPanelVoiceIntent,
  type PanelVoiceIntent,
} from '../voice/panelCommands';
import { readVoicePrefs } from './useVoiceControl';

interface UsePanelVoiceControlOptions {
  onIntent: (intent: PanelVoiceIntent) => void;
}

interface UsePanelVoiceControlReturn {
  isSupported: boolean;
  isListening: boolean;
  lastHeard: string | null;
  toggle: () => void;
  stop: () => void;
}

/**
 * Speech-recognition wrapper for Panel Mode voice commands.
 *
 * Mirrors the plumbing of `useVoiceControl` (silence timeout, visibility
 * pause, auto-restart, max alternatives) but swaps the matcher for the
 * richer panel grammar so it can also parse jump-to-row, read-panel, and
 * where-am-I intents.
 */
export function usePanelVoiceControl({
  onIntent,
}: UsePanelVoiceControlOptions): UsePanelVoiceControlReturn {
  const [isListening, setIsListening] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIntentRef = useRef(onIntent);

  useEffect(() => {
    onIntentRef.current = onIntent;
  }, [onIntent]);

  const isSupported =
    typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearSilenceTimer();
    isListeningRef.current = false;
    setIsListening(false);
    setLastHeard(null);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('[PanelVoice] stop error:', e);
      }
    }
  }, [clearSilenceTimer]);

  const armSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    const prefs = readVoicePrefs();
    if (prefs.timeoutSec <= 0) return;
    silenceTimerRef.current = setTimeout(() => {
      if (isListeningRef.current) {
        toast.info('Voice control stopped (no speech detected)', {
          autoClose: 2000,
        });
        stop();
      }
    }, prefs.timeoutSec * 1000);
  }, [clearSilenceTimer, stop]);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event: any) => {
      armSilenceTimer();
      const last = event.results.length - 1;
      const alternatives = event.results[last];

      let matched: PanelVoiceIntent | null = null;
      let heard: string | null = null;
      for (let i = 0; i < alternatives.length; i++) {
        const phrase = alternatives[i].transcript.trim();
        if (heard === null) heard = phrase;
        const intent = matchPanelVoiceIntent(phrase);
        if (intent) {
          matched = intent;
          heard = phrase;
          break;
        }
      }

      if (heard) setLastHeard(heard);
      if (matched) onIntentRef.current(matched);
    };

    recognition.onerror = (event: any) => {
      console.error('[PanelVoice] Recognition error:', event.error);
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      toast.error(`Voice error: ${event.error}`, { autoClose: 2000 });
      if (
        event.error === 'not-allowed' ||
        event.error === 'service-not-allowed' ||
        event.error === 'audio-capture'
      ) {
        stop();
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.warn('[PanelVoice] restart failed:', e);
              stop();
            }
          }
        }, 100);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      clearSilenceTimer();
      isListeningRef.current = false;
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
    };
  }, [isSupported, armSilenceTimer, clearSilenceTimer, stop]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && isListeningRef.current) {
        stop();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, [stop]);

  const toggle = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      toast.error('Voice control not supported in this browser');
      return;
    }

    if (isListeningRef.current) {
      stop();
      toast.info('Voice control stopped');
      return;
    }

    const prefs = readVoicePrefs();
    try {
      recognitionRef.current.lang = prefs.lang;
    } catch {
      recognitionRef.current.lang = 'en-US';
    }

    try {
      recognitionRef.current.start();
      isListeningRef.current = true;
      setIsListening(true);
      setLastHeard(null);
      armSilenceTimer();
      toast.success('Voice control activated');
    } catch (e) {
      console.error('[PanelVoice] start error:', e);
      toast.error('Failed to start voice control');
    }
  }, [isSupported, stop, armSilenceTimer]);

  return { isSupported, isListening, lastHeard, toggle, stop };
}

/**
 * TTS helper that always speaks — unlike `speakIfEnabled`, this ignores the
 * global TTS preference because it's only called in direct response to a
 * voice intent (where audio feedback is the whole point).
 */
export function speakAlways(text: string): void {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const prefs = readVoicePrefs();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = prefs.lang;
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('[PanelVoice] TTS failed:', e);
  }
}
