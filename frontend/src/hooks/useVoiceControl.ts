import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

export type VoiceCommand = 'increment' | 'decrement' | 'reset';

const INCREMENT_RE =
  /\b(next|plus|add|up|increment|forward|more|another|mark|tick|count|advance|go)\b/;
const DECREMENT_RE =
  /\b(back|minus|undo|down|decrement|previous|oops|mistake|return|rewind|last)\b/;
const RESET_RE = /\b(reset|clear|restart|zero)\b/;

export function matchVoiceCommand(transcript: string): VoiceCommand | null {
  const normalized = transcript.toLowerCase().trim();
  if (INCREMENT_RE.test(normalized)) return 'increment';
  if (DECREMENT_RE.test(normalized)) return 'decrement';
  if (RESET_RE.test(normalized)) return 'reset';
  return null;
}

type VoicePrefs = {
  ttsEnabled: boolean;
  timeoutSec: number;
  lang: string;
};

const PREFS_KEY = 'rowly:voice:prefs';
const DEFAULT_PREFS: VoicePrefs = {
  ttsEnabled: false,
  timeoutSec: 120,
  lang: 'en-US',
};

export function readVoicePrefs(): VoicePrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<VoicePrefs>;
    return {
      ttsEnabled: typeof parsed.ttsEnabled === 'boolean' ? parsed.ttsEnabled : DEFAULT_PREFS.ttsEnabled,
      timeoutSec: typeof parsed.timeoutSec === 'number' ? parsed.timeoutSec : DEFAULT_PREFS.timeoutSec,
      lang: typeof parsed.lang === 'string' ? parsed.lang : DEFAULT_PREFS.lang,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writeVoicePrefs(prefs: VoicePrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function speakIfEnabled(text: string): void {
  if (!('speechSynthesis' in window)) return;
  const prefs = readVoicePrefs();
  if (!prefs.ttsEnabled) return;
  try {
    // Barge-in: cancel any in-flight utterance so rapid commands don't queue up.
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = prefs.lang;
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('[Voice] TTS failed:', e);
  }
}

interface UseVoiceControlOptions {
  onCommand: (command: VoiceCommand) => void;
}

interface UseVoiceControlReturn {
  isSupported: boolean;
  isListening: boolean;
  lastHeard: string | null;
  toggle: () => void;
  stop: () => void;
}

/**
 * Web Speech API wrapper for knitting voice commands.
 *
 * Handles: vocabulary matching (with up to 3 alternate transcriptions),
 * auto-timeout after silence, permission errors, and cleanup on unmount.
 * Preferences (timeout, language) are read fresh from localStorage on every
 * `toggle()` so changes in Settings take effect without a page reload.
 */
export function useVoiceControl({ onCommand }: UseVoiceControlOptions): UseVoiceControlReturn {
  const [isListening, setIsListening] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCommandRef = useRef(onCommand);

  // Keep latest callback without retriggering the setup effect.
  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

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
        console.warn('[Voice] stop error:', e);
      }
    }
  }, [clearSilenceTimer]);

  const armSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    const prefs = readVoicePrefs();
    if (prefs.timeoutSec <= 0) return;
    silenceTimerRef.current = setTimeout(() => {
      if (isListeningRef.current) {
        toast.info('Voice control stopped (no speech detected)', { autoClose: 2000 });
        stop();
      }
    }, prefs.timeoutSec * 1000);
  }, [clearSilenceTimer, stop]);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event: any) => {
      armSilenceTimer();
      const last = event.results.length - 1;
      const alternatives = event.results[last];

      // Pick the first alternative that matches a known command; fall back to
      // the top guess for the transcript chip even if nothing matched.
      let matched: VoiceCommand | null = null;
      let heard: string | null = null;
      for (let i = 0; i < alternatives.length; i++) {
        const phrase = alternatives[i].transcript.trim();
        if (heard === null) heard = phrase;
        const cmd = matchVoiceCommand(phrase);
        if (cmd) {
          matched = cmd;
          heard = phrase;
          break;
        }
      }

      if (heard) setLastHeard(heard);
      if (matched) onCommandRef.current(matched);
    };

    recognition.onerror = (event: any) => {
      console.error('[Voice] Recognition error:', event.error);
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
      // Browsers often end the session between utterances; auto-restart while
      // we still mean to be listening. A small delay avoids rapid-cycling.
      if (isListeningRef.current) {
        setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.warn('[Voice] restart failed:', e);
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

  // If the page is hidden (tab switch, screen lock), stop listening so we
  // don't silently burn battery with the mic hot.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && isListeningRef.current) {
        stop();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
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

    // Apply the latest language pref on each start so settings changes take
    // effect without a reload.
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
      toast.success('Voice control activated!');
    } catch (e) {
      console.error('[Voice] start error:', e);
      toast.error('Failed to start voice control');
    }
  }, [isSupported, stop, armSilenceTimer]);

  return { isSupported, isListening, lastHeard, toggle, stop };
}
