import { useState } from 'react';
import { FiX, FiHelpCircle } from 'react-icons/fi';

interface Props {
  onClose: () => void;
}

type Tab = 'shortcuts' | 'markers' | 'symbols';

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: '←  →', action: 'Previous / next page' },
  { keys: 'Home / End', action: 'First / last page' },
  { keys: '+  −', action: 'Zoom in / out' },
  { keys: 'Ctrl + F', action: 'Search pattern text' },
  { keys: 'Esc', action: 'Close search / close marker' },
  { keys: '↑  ↓', action: 'Nudge row marker (when active)' },
  { keys: 'Ctrl + L', action: 'Lock / unlock marker' },
  { keys: 'Ctrl + H', action: 'Hide / show marker' },
];

const MARKER_LEGEND: Array<{ color: string; name: string; usage: string }> = [
  { color: '#FBBF24', name: 'Yellow', usage: 'Default highlight band' },
  { color: '#EF4444', name: 'Red', usage: 'Stop / shaping row' },
  { color: '#3B82F6', name: 'Blue', usage: 'Section start / repeat' },
  { color: '#10B981', name: 'Green', usage: 'Completed / safe' },
  { color: '#8B5CF6', name: 'Purple', usage: 'Optional / variant' },
  { color: '#1F2937', name: 'Dim', usage: 'Inverted spotlight overlay' },
];

export default function QuickKeyPanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('shortcuts');

  return (
    <div className="fixed top-20 right-4 z-50 w-80 bg-gray-800 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <FiHelpCircle className="h-4 w-4 text-purple-400" />
          <h4 className="font-semibold text-sm">Quick Key</h4>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-700 rounded text-gray-400"
          title="Close"
        >
          <FiX className="h-4 w-4" />
        </button>
      </div>

      <div className="flex border-b border-gray-700">
        {(['shortcuts', 'markers', 'symbols'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-2 text-xs font-medium capitalize ${
              tab === t
                ? 'bg-gray-700 text-white border-b-2 border-purple-500'
                : 'text-gray-400 hover:bg-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="p-3 max-h-96 overflow-y-auto text-sm">
        {tab === 'shortcuts' && (
          <ul className="space-y-2">
            {SHORTCUTS.map((s) => (
              <li key={s.keys} className="flex items-center justify-between gap-3">
                <kbd className="bg-gray-900 px-2 py-1 rounded text-xs font-mono text-purple-300 whitespace-nowrap">
                  {s.keys}
                </kbd>
                <span className="text-gray-300 text-xs text-right">{s.action}</span>
              </li>
            ))}
          </ul>
        )}

        {tab === 'markers' && (
          <ul className="space-y-2">
            {MARKER_LEGEND.map((m) => (
              <li key={m.color} className="flex items-center gap-3">
                <span
                  className="w-5 h-5 rounded border border-gray-600 flex-shrink-0"
                  style={{ backgroundColor: m.color }}
                />
                <span className="text-gray-200 font-medium text-xs w-14">{m.name}</span>
                <span className="text-gray-400 text-xs">{m.usage}</span>
              </li>
            ))}
            <li className="text-xs text-gray-500 pt-2 border-t border-gray-700 mt-2">
              Color meanings are conventions — change anytime in the marker controls.
            </li>
          </ul>
        )}

        {tab === 'symbols' && (
          <div className="text-xs text-gray-400 space-y-2">
            <p>
              Pattern-specific symbol keys appear here once the project's Pattern Builder
              has been set up with a legend.
            </p>
            <p className="text-gray-500">
              Tip: open the project's Pattern Builder tab to add symbol meanings; they will
              show in this panel during knitting sessions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
