// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiMove,
  FiX,
  FiEye,
  FiEyeOff,
  FiSun,
  FiMoon,
  FiChevronUp,
  FiChevronDown,
} from 'react-icons/fi';

interface RowMarkerProps {
  pageNumber: number;
  onPositionChange?: (position: { x: number; y: number }) => void;
  /** When provided, the marker's per-page position + height are saved to
   *  localStorage under a key scoped to this pattern id. Without it the
   *  marker still works but resets when the page or reload changes. */
  patternId?: string;
  /** If set, called with +1 / -1 when the user taps the row-step buttons.
   *  Lets a parent wire the marker to a project counter so every step
   *  goes through the existing counter pipeline (WebSocket sync, voice).
   *  The marker itself still moves visually regardless. */
  onStep?: (delta: number) => void;
  /** Short label rendered above the step buttons — e.g., "Row 27 of 45".
   *  Typically set by the parent that also supplies onStep. */
  stepLabel?: string;
}

const MARKER_COLORS = [
  { name: 'Yellow', value: '#FBBF24', opacity: 0.3 },
  { name: 'Red', value: '#EF4444', opacity: 0.3 },
  { name: 'Blue', value: '#3B82F6', opacity: 0.3 },
  { name: 'Green', value: '#10B981', opacity: 0.3 },
  { name: 'Purple', value: '#8B5CF6', opacity: 0.3 },
  { name: 'Dim', value: '#1F2937', opacity: 0.5 },
];

const PREFS_KEY = 'rowly:markerPrefs:v1';

const DEFAULT_PREFS = {
  color: MARKER_COLORS[0].value,
  opacity: 0.3,
  height: 3,
  width: 90,
  style: 'bar', // 'bar' | 'lines' | 'underline'
  isInverted: false,
};

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota / private mode errors
  }
}

function hexToRgba(hex, alpha) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Per-(patternId, pageNumber) position + height persistence so the
// marker remembers "I was on row 27 of page 3" across reloads.
const POS_KEY_PREFIX = 'rowly:rowMarker:v1';
function posKey(patternId: string, page: number) {
  return `${POS_KEY_PREFIX}:${patternId}:${page}`;
}
function loadPagePos(patternId: string | undefined, page: number) {
  if (!patternId) return null;
  try {
    const raw = localStorage.getItem(posKey(patternId, page));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.posY === 'number' && typeof parsed?.height === 'number') {
      return parsed as { posY: number; height: number };
    }
  } catch {
    /* ignore parse / quota errors */
  }
  return null;
}
function savePagePos(patternId: string | undefined, page: number, posY: number, height: number) {
  if (!patternId) return;
  try {
    localStorage.setItem(posKey(patternId, page), JSON.stringify({ posY, height }));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export default function RowMarker({
  pageNumber,
  onPositionChange,
  patternId,
  onStep,
  stepLabel,
}: RowMarkerProps) {
  const initial = loadPrefs();
  const saved = loadPagePos(patternId, pageNumber);
  const [position, setPosition] = useState({ x: 50, y: saved?.posY ?? 50 });
  const [height, setHeight] = useState(saved?.height ?? initial.height);
  const [width, setWidth] = useState(initial.width);
  const [style, setStyle] = useState(initial.style);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [color, setColor] = useState(initial.color);
  const [opacity, setOpacity] = useState(initial.opacity);
  const [isLocked, setIsLocked] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isInverted, setIsInverted] = useState(initial.isInverted);
  const [showControls, setShowControls] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Persist user style preferences (not session-only state like position/lock/visibility)
  useEffect(() => {
    savePrefs({ color, opacity, height, width, style, isInverted });
  }, [color, opacity, height, width, style, isInverted]);

  // Reload saved position + height when the viewed page (or pattern) changes.
  // Without this the marker would stay on the old y-% even when the user flips
  // to a different page that has its own remembered row.
  const lastKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!patternId) return;
    const key = posKey(patternId, pageNumber);
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    const rec = loadPagePos(patternId, pageNumber);
    if (rec) {
      setPosition((prev) => ({ ...prev, y: rec.posY }));
      setHeight(rec.height);
    }
  }, [patternId, pageNumber]);

  // Persist position + height for this (pattern, page) whenever they change.
  useEffect(() => {
    savePagePos(patternId, pageNumber, position.y, height);
  }, [patternId, pageNumber, position.y, height]);

  // Step the marker by exactly one row (height). Also notifies the parent
  // so it can pipe the delta into a counter. The marker moves visually
  // even when onStep is not provided — it's still useful for standalone
  // PDF viewing.
  const handleStep = useCallback(
    (delta: 1 | -1) => {
      setPosition((prev) => {
        const nextY = Math.max(0, Math.min(100 - height, prev.y + delta * height));
        return { ...prev, y: nextY };
      });
      onStep?.(delta);
    },
    [height, onStep],
  );

  // Handle dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isLocked) return;

    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - (position.x * window.innerWidth) / 100,
      y: e.clientY - (position.y * window.innerHeight) / 100,
    });
  }, [isLocked, position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || isLocked) return;

    const newX = ((e.clientX - dragStart.x) / window.innerWidth) * 100;
    const newY = ((e.clientY - dragStart.y) / window.innerHeight) * 100;

    setPosition({
      x: Math.max(0, Math.min(100, newX)),
      y: Math.max(0, Math.min(100 - height, newY)),
    });
  }, [isDragging, isLocked, dragStart, height]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onPositionChange?.(position);
    }
    setIsResizing(false);
  }, [isDragging, position, onPositionChange]);

  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (isLocked) return;
    e.stopPropagation();
    setIsResizing(true);
  }, [isLocked]);

  const handleResize = useCallback((e: MouseEvent) => {
    if (!isResizing || isLocked) return;

    const newHeight = (e.clientY / window.innerHeight) * 100 - position.y;
    setHeight(Math.max(1, Math.min(20, newHeight)));
  }, [isResizing, isLocked, position.y]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) return;

      // Skip shortcut handling when the user is typing in an input or
      // contenteditable element — otherwise PageDown/Space steals input focus.
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (typing) return;

      switch (e.key) {
        case 'ArrowUp':
          if (!isLocked) {
            e.preventDefault();
            setPosition(prev => ({ ...prev, y: Math.max(0, prev.y - 1) }));
          }
          break;
        case 'ArrowDown':
          if (!isLocked) {
            e.preventDefault();
            setPosition(prev => ({ ...prev, y: Math.min(100 - height, prev.y + 1) }));
          }
          break;
        // Row-step shortcuts — move by exactly one row. These work even when
        // locked because step-mode is the whole point of that lock (fine drag
        // is disabled but per-row advance is still expected).
        case 'PageDown':
        case ' ':
          e.preventDefault();
          handleStep(1);
          break;
        case 'PageUp':
          e.preventDefault();
          handleStep(-1);
          break;
        case 'l':
        case 'L':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setIsLocked(!isLocked);
          }
          break;
        case 'h':
        case 'H':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setIsVisible(!isVisible);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, isLocked, height, handleStep]);

  // Mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResize);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleResize);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleResize, handleMouseUp]);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed top-20 right-4 z-50 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg shadow-lg flex items-center gap-2"
        title="Show row marker (Ctrl+H)"
      >
        <FiEye className="h-4 w-4" />
        Show Marker
      </button>
    );
  }

  return (
    <>
      {/* Inverted mode: dim everything except the active row */}
      {isInverted && (
        <>
          <div
            className="fixed left-0 right-0 top-0 z-40 pointer-events-none"
            style={{
              height: `${position.y}%`,
              backgroundColor: color,
              opacity: opacity,
            }}
          />
          <div
            className="fixed left-0 right-0 bottom-0 z-40 pointer-events-none"
            style={{
              top: `${position.y + height}%`,
              backgroundColor: color,
              opacity: opacity,
            }}
          />
        </>
      )}

      {/* Row Marker (band mode) / Spotlight handle (inverted mode) */}
      <div
        className={`fixed z-40 transition-opacity ${isDragging ? 'cursor-move' : ''} ${
          isLocked ? 'pointer-events-none' : 'cursor-move'
        }`}
        style={{
          left: isInverted ? '0%' : `${position.x}%`,
          top: `${position.y}%`,
          width: isInverted ? '100%' : `${width}%`,
          height: `${height}%`,
          backgroundColor: isInverted || style !== 'bar' ? 'transparent' : color,
          opacity: isInverted ? 1 : (style === 'bar' ? opacity : 1),
          transform: isInverted ? 'none' : 'translate(-50%, 0)',
          borderTop: isInverted
            ? '2px solid rgba(255,255,255,0.5)'
            : style === 'lines'
              ? `2px solid ${hexToRgba(color, Math.max(0.75, opacity))}`
              : undefined,
          borderBottom: isInverted
            ? '2px solid rgba(255,255,255,0.5)'
            : style === 'lines' || style === 'underline'
              ? `2px solid ${hexToRgba(color, Math.max(0.75, opacity))}`
              : undefined,
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => !isLocked && setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        {/* Controls */}
        {showControls && !isLocked && (
          <div className="absolute top-0 right-0 flex items-center gap-1 bg-gray-900 bg-opacity-90 rounded-bl-lg p-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsVisible(false);
              }}
              className="p-1 hover:bg-gray-700 rounded text-white"
              title="Hide marker"
            >
              <FiEyeOff className="h-3 w-3" />
            </button>
            <FiMove className="h-3 w-3 text-white" title="Drag to move" />
          </div>
        )}

        {/* Resize Handle */}
        {!isLocked && (
          <div
            className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-gray-900 bg-opacity-50 hover:bg-opacity-75"
            onMouseDown={handleResizeStart}
            title="Drag to resize"
          />
        )}
      </div>

      {/* Control Panel */}
      <div className="fixed top-20 right-4 z-50 bg-gray-800 rounded-lg shadow-lg p-3 space-y-3 w-64">
        <div className="flex items-center justify-between">
          <h4 className="text-white font-semibold text-sm">Row Marker</h4>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-gray-700 rounded text-gray-400"
            title="Hide marker (Ctrl+H)"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Toggle: Band vs Inverted */}
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2">Mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => setIsInverted(false)}
              className={`flex-1 px-2 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 ${
                !isInverted
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title="Highlight the active row with color"
            >
              <FiSun className="h-3 w-3" /> Band
            </button>
            <button
              onClick={() => {
                setIsInverted(true);
                if (color !== '#1F2937') {
                  setColor('#1F2937');
                  setOpacity(0.5);
                }
              }}
              className={`flex-1 px-2 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 ${
                isInverted
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title="Dim everything except the active row"
            >
              <FiMoon className="h-3 w-3" /> Inverted
            </button>
          </div>
        </div>

        {/* Style (band shape) — only meaningful in non-inverted mode */}
        {!isInverted && (
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Style</label>
            <div className="flex gap-2">
              {[
                { id: 'bar', label: 'Bar', help: 'Solid colored band across the row' },
                { id: 'lines', label: 'Lines', help: 'Two thin lines (top + bottom of row)' },
                { id: 'underline', label: 'Underline', help: 'Single line beneath the row' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium ${
                    style === s.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title={s.help}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Color Selection */}
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2">
            {isInverted ? 'Dim color' : 'Color'}
          </label>
          <div className="flex gap-2">
            {MARKER_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className={`w-8 h-8 rounded border-2 ${
                  color === c.value ? 'border-white' : 'border-gray-600'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        {/* Width slider (band-mode only) */}
        {!isInverted && (
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">
              Width: {width.toFixed(0)}%
            </label>
            <input
              type="range"
              min="40"
              max="100"
              step="5"
              value={width}
              onChange={(e) => setWidth(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        )}

        {/* Opacity Slider */}
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2">
            Opacity: {Math.round(opacity * 100)}%
          </label>
          <input
            type="range"
            min="0.1"
            max="0.8"
            step="0.1"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Height Slider */}
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2">
            Height: {height.toFixed(1)}%
          </label>
          <input
            type="range"
            min="1"
            max="20"
            step="0.5"
            value={height}
            onChange={(e) => setHeight(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Row-step buttons — advance the marker by exactly one row. Uses
            the current Height setting as the step size, so the user
            calibrates once (drag + resize to match pattern row height)
            and then steps without losing alignment. */}
        <div className="pt-2 border-t border-gray-700">
          {stepLabel && (
            <p className="text-xs text-gray-300 mb-2 text-center font-medium">{stepLabel}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => handleStep(-1)}
              className="flex-1 h-10 rounded bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center gap-1 text-sm font-medium"
              title="Previous row (PageUp)"
              aria-label="Previous row"
            >
              <FiChevronUp className="h-4 w-4" /> Prev
            </button>
            <button
              onClick={() => handleStep(1)}
              className="flex-1 h-10 rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1 text-sm font-medium"
              title="Next row (PageDown or Space)"
              aria-label="Next row"
            >
              Next <FiChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Lock Toggle */}
        <button
          onClick={() => setIsLocked(!isLocked)}
          className={`w-full px-3 py-2 rounded text-sm font-medium ${
            isLocked
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
        >
          {isLocked ? '🔒 Locked' : '🔓 Unlocked'} (Ctrl+L)
        </button>

        {/* Instructions */}
        <div className="text-xs text-gray-400 space-y-1 pt-2 border-t border-gray-700">
          <p>• Drag marker to position row 1</p>
          <p>• Drag bottom edge to match row height</p>
          <p>• Space / PageDown → next row</p>
          <p>• PageUp → prev row</p>
          <p>• Arrow keys fine-tune by 1%</p>
          <p>• Ctrl+L lock, Ctrl+H hide</p>
        </div>
      </div>
    </>
  );
}
