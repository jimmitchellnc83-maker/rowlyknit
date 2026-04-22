// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { FiMove, FiX, FiEye, FiEyeOff, FiSun, FiMoon } from 'react-icons/fi';

interface RowMarkerProps {
  pageNumber: number;
  onPositionChange?: (position: { x: number; y: number }) => void;
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

export default function RowMarker({ pageNumber, onPositionChange }: RowMarkerProps) {
  const initial = loadPrefs();
  const [position, setPosition] = useState({ x: 50, y: 50 }); // Percentage based
  const [height, setHeight] = useState(initial.height);
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
  }, [isVisible, isLocked, height]);

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
          <p>• Drag marker to move</p>
          <p>• Drag bottom edge to resize</p>
          <p>• Arrow keys to fine-tune</p>
          <p>• Ctrl+L to lock/unlock</p>
          <p>• Ctrl+H to hide/show</p>
        </div>
      </div>
    </>
  );
}
