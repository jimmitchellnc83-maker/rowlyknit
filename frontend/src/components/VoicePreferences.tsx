import { useState } from 'react';
import { FiSave, FiMic, FiVolume2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { readVoicePrefs, writeVoicePrefs, speakIfEnabled } from '../hooks/useVoiceControl';

const LANGUAGES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-AU', label: 'English (Australia)' },
  { value: 'en-CA', label: 'English (Canada)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'es-MX', label: 'Spanish (Mexico)' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'ja-JP', label: 'Japanese' },
] as const;

const TIMEOUT_OPTIONS = [
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 0, label: 'Never (until I stop it)' },
] as const;

export default function VoicePreferences() {
  const [prefs, setPrefs] = useState(() => readVoicePrefs());

  const isSpeechSupported =
    typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  const isTtsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const save = () => {
    writeVoicePrefs(prefs);
    toast.success('Voice preferences saved!');
  };

  const testTts = () => {
    if (!prefs.ttsEnabled) {
      toast.info('Enable "speak counter value" first, then test.');
      return;
    }
    // speakIfEnabled reads prefs from storage; save first so the test uses the
    // language the user just picked (even if they haven't clicked Save yet).
    writeVoicePrefs(prefs);
    speakIfEnabled('Row fifteen');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Voice control
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Control row counters hands-free while knitting. Tap the mic icon on any counter card to
        start listening.
      </p>

      {!isSpeechSupported && (
        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-900/30 dark:bg-yellow-900/20 dark:text-yellow-200">
          Your browser doesn&apos;t support the Web Speech API (voice recognition). Try Chrome,
          Edge, or Safari on desktop or mobile.
        </div>
      )}

      <div className="space-y-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.ttsEnabled}
            disabled={!isTtsSupported}
            onChange={(e) => setPrefs({ ...prefs, ttsEnabled: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
          />
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              <FiVolume2 className="inline mr-1 h-4 w-4" />
              Speak counter value after each voice command
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Rowly will say the new count out loud (e.g. &ldquo;sixteen&rdquo;) so you can keep
              your eyes on your knitting. Uses your device&apos;s text-to-speech.
              {!isTtsSupported && (
                <span className="text-yellow-700 dark:text-yellow-400 ml-1">
                  (Not supported in this browser.)
                </span>
              )}
            </span>
          </div>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Auto-stop after silence
          </label>
          <select
            value={prefs.timeoutSec}
            onChange={(e) => setPrefs({ ...prefs, timeoutSec: Number(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            {TIMEOUT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Voice control will stop listening after this much silence to save battery. You can
            always tap the mic to resume.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Recognition language
          </label>
          <select
            value={prefs.lang}
            onChange={(e) => setPrefs({ ...prefs, lang: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            The default vocabulary (next, back, reset, etc.) is tuned for English. Non-English
            support depends on your browser&apos;s speech engine.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={save}
          className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          <FiSave className="h-4 w-4" />
          Save Preferences
        </button>
        <button
          onClick={testTts}
          disabled={!isTtsSupported || !prefs.ttsEnabled}
          className="flex items-center gap-2 px-6 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiMic className="h-4 w-4" />
          Test text-to-speech
        </button>
      </div>
    </div>
  );
}
