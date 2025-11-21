import { useState, useEffect, useCallback } from 'react';
import { FiMove, FiX, FiEye, FiEyeOff } from 'react-icons/fi';

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
];

export default function RowMarker({ pageNumber: _pageNumber, onPositionChange }: RowMarkerProps) {
  const [position, setPosition] = useState({ x: 50, y: 50 }); // Percentage based
  const [height, setHeight] = useState(3); // Percentage of viewport
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [color, setColor] = useState(MARKER_COLORS[0].value);
  const [opacity, setOpacity] = useState(0.3);
  const [isLocked, setIsLocked] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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
      {/* Row Marker */}
      <div
        className={`fixed z-40 transition-opacity ${isDragging ? 'cursor-move' : ''} ${
          isLocked ? 'pointer-events-none' : 'cursor-move'
        }`}
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          width: '90%',
          height: `${height}%`,
          backgroundColor: color,
          opacity: opacity,
          transform: 'translate(-50%, 0)',
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

        {/* Color Selection */}
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2">Color</label>
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
