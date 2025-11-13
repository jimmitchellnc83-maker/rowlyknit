import { useState, useRef, useEffect, useCallback } from 'react';
import { FiEdit3, FiX, FiTrash2, FiEye, FiEyeOff } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';

interface Highlight {
  id: string;
  pattern_id: string;
  project_id: string | null;
  page_number: number;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  color: string;
  opacity: number;
  layer: number;
}

interface PatternHighlighterProps {
  patternId: string;
  projectId?: string;
  pageNumber: number;
  isActive: boolean;
}

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#FBBF24' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
];

export default function PatternHighlighter({
  patternId,
  projectId,
  pageNumber,
  isActive,
}: PatternHighlighterProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<any>(null);
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0].value);
  const [opacity, setOpacity] = useState(0.3);
  const [showControls, setShowControls] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive) {
      fetchHighlights();
    }
  }, [patternId, projectId, pageNumber, isActive]);

  useEffect(() => {
    if (isActive) {
      drawHighlights();
    }
  }, [highlights, isActive]);

  const fetchHighlights = async () => {
    try {
      const params: any = { pageNumber };
      if (projectId) params.projectId = projectId;

      const response = await axios.get(`/api/patterns/${patternId}/highlights`, { params });
      setHighlights(response.data.data.highlights || []);
    } catch (error) {
      console.error('Error fetching highlights:', error);
    }
  };

  const drawHighlights = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all highlights
    highlights.forEach((highlight) => {
      ctx.fillStyle = highlight.color;
      ctx.globalAlpha = highlight.opacity;
      ctx.fillRect(
        highlight.coordinates.x,
        highlight.coordinates.y,
        highlight.coordinates.width,
        highlight.coordinates.height
      );
    });

    // Draw current rectangle being drawn
    if (currentRect) {
      ctx.fillStyle = selectedColor;
      ctx.globalAlpha = opacity;
      ctx.fillRect(currentRect.x, currentRect.y, currentRect.width, currentRect.height);
    }

    ctx.globalAlpha = 1;
  };

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isActive) return;

    const pos = getMousePos(e);
    setStartPos(pos);
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;

    const pos = getMousePos(e);
    const width = pos.x - startPos.x;
    const height = pos.y - startPos.y;

    setCurrentRect({
      x: width < 0 ? pos.x : startPos.x,
      y: height < 0 ? pos.y : startPos.y,
      width: Math.abs(width),
      height: Math.abs(height),
    });

    drawHighlights();
  };

  const handleMouseUp = async () => {
    if (!isDrawing || !currentRect) {
      setIsDrawing(false);
      return;
    }

    // Only save if rectangle is large enough
    if (currentRect.width > 5 && currentRect.height > 5) {
      await saveHighlight(currentRect);
    }

    setIsDrawing(false);
    setStartPos(null);
    setCurrentRect(null);
  };

  const saveHighlight = async (coordinates: any) => {
    try {
      await axios.post(`/api/patterns/${patternId}/highlights`, {
        pageNumber,
        coordinates,
        color: selectedColor,
        opacity,
        projectId: projectId || null,
      });

      toast.success('Highlight saved!');
      fetchHighlights();
    } catch (error) {
      console.error('Error saving highlight:', error);
      toast.error('Failed to save highlight');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all highlights on this page?')) return;

    try {
      // Delete all highlights for this page
      await Promise.all(
        highlights.map((h) =>
          axios.delete(`/api/patterns/${patternId}/highlights/${h.id}`)
        )
      );

      toast.success('All highlights cleared');
      setHighlights([]);
    } catch (error) {
      console.error('Error clearing highlights:', error);
      toast.error('Failed to clear highlights');
    }
  };

  if (!isActive) return null;

  return (
    <>
      {/* Canvas overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-30 pointer-events-auto"
        style={{ cursor: isDrawing ? 'crosshair' : 'default' }}
        width={containerRef.current?.clientWidth || 800}
        height={containerRef.current?.clientHeight || 1000}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Control Panel */}
      <div className="fixed top-20 right-4 z-50 bg-gray-800 rounded-lg shadow-lg p-3 space-y-3 w-64">
        <div className="flex items-center justify-between">
          <h4 className="text-white font-semibold text-sm">Highlighter</h4>
          <button
            onClick={() => setShowControls(!showControls)}
            className="p-1 hover:bg-gray-700 rounded text-gray-400"
          >
            {showControls ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
          </button>
        </div>

        {showControls && (
          <>
            {/* Instructions */}
            <div className="text-xs text-gray-300 bg-gray-700 rounded p-2">
              <p>Click and drag to highlight</p>
            </div>

            {/* Color Selection */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-2">Color</label>
              <div className="grid grid-cols-3 gap-2">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setSelectedColor(c.value)}
                    className={`h-10 rounded border-2 ${
                      selectedColor === c.value ? 'border-white' : 'border-gray-600'
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
                max="0.6"
                step="0.1"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Highlight Count */}
            <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
              {highlights.length} highlight{highlights.length !== 1 ? 's' : ''} on this page
            </div>

            {/* Clear All Button */}
            {highlights.length > 0 && (
              <button
                onClick={handleClearAll}
                className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium flex items-center justify-center gap-2"
              >
                <FiTrash2 className="h-4 w-4" />
                Clear All
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
