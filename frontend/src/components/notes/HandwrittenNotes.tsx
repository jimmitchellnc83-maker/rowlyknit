import React, { useRef, useState, useEffect } from 'react';
import { Pen, Eraser, Download, Trash2, Undo, Redo, Palette } from 'lucide-react';

interface HandwrittenNotesProps {
  patternId?: string;
  projectId: string;
  pageNumber?: number;
  onSave?: (imageData: string) => Promise<void>;
  initialData?: string; // Base64 image data
}

interface DrawingPoint {
  x: number;
  y: number;
}

interface DrawingPath {
  points: DrawingPoint[];
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
}

const COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Yellow', value: '#FBBF24' },
];

const LINE_WIDTHS = [2, 4, 6, 8, 12];

export const HandwrittenNotes: React.FC<HandwrittenNotesProps> = ({
  patternId,
  projectId,
  pageNumber,
  onSave,
  initialData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<DrawingPoint[]>([]);
  const [paths, setPaths] = useState<DrawingPath[]>([]);
  const [undoStack, setUndoStack] = useState<DrawingPath[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawingPath[][]>([]);

  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(4);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showWidthPicker, setShowWidthPicker] = useState(false);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Set canvas size to match container
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = Math.max(rect.height, 400);

    // Set white background
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Load initial data if provided
      if (initialData) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
        };
        img.src = initialData;
      }
    }
  }, [initialData]);

  // Redraw canvas when paths change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all paths
    paths.forEach((path) => {
      if (path.points.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = path.tool === 'eraser' ? '#FFFFFF' : path.color;
      ctx.lineWidth = path.tool === 'eraser' ? path.width * 2 : path.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    });
  }, [paths]);

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): DrawingPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const point = getCanvasPoint(e);
    setCurrentPath([point]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const point = getCanvasPoint(e);
    setCurrentPath((prev) => [...prev, point]);

    // Draw current stroke immediately
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || currentPath.length === 0) return;

    ctx.beginPath();
    ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 2 : lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const lastPoint = currentPath[currentPath.length - 1];
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPath.length > 1) {
      const newPath: DrawingPath = {
        points: currentPath,
        color,
        width: lineWidth,
        tool,
      };

      // Save state for undo
      setUndoStack((prev) => [...prev, paths]);
      setRedoStack([]); // Clear redo stack on new action

      setPaths((prev) => [...prev, newPath]);
    }

    setCurrentPath([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, paths]);
    setPaths(previousState);
    setUndoStack((prev) => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, paths]);
    setPaths(nextState);
    setRedoStack((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (paths.length === 0) return;

    setUndoStack((prev) => [...prev, paths]);
    setRedoStack([]);
    setPaths([]);
  };

  const handleExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageData = canvas.toDataURL('image/png');

    if (onSave) {
      try {
        await onSave(imageData);
        alert('Notes saved successfully!');
      } catch (error) {
        console.error('Failed to save notes:', error);
        alert('Failed to save notes');
      }
    } else {
      // Download as file
      const link = document.createElement('a');
      link.download = `notes-${Date.now()}.png`;
      link.href = imageData;
      link.click();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Handwritten Notes
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo"
          >
            <Undo className="w-5 h-5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo"
          >
            <Redo className="w-5 h-5" />
          </button>
          <button
            onClick={handleClear}
            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            title="Clear all"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleExport}
            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
            title="Save/Export"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Drawing Tools */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex-wrap">
        {/* Tool Selection */}
        <div className="flex gap-2">
          <button
            onClick={() => setTool('pen')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              tool === 'pen'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-500'
            }`}
          >
            <Pen className="w-4 h-4" />
            Pen
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              tool === 'eraser'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-500'
            }`}
          >
            <Eraser className="w-4 h-4" />
            Eraser
          </button>
        </div>

        {/* Color Picker */}
        {tool === 'pen' && (
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg"
            >
              <Palette className="w-4 h-4" />
              <div
                className="w-6 h-6 rounded border-2 border-gray-300"
                style={{ backgroundColor: color }}
              />
            </button>
            {showColorPicker && (
              <div className="absolute top-full mt-2 p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10">
                <div className="grid grid-cols-4 gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => {
                        setColor(c.value);
                        setShowColorPicker(false);
                      }}
                      className={`w-8 h-8 rounded border-2 transition-transform hover:scale-110 ${
                        color === c.value
                          ? 'border-blue-600 ring-2 ring-blue-300'
                          : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Line Width */}
        <div className="relative">
          <button
            onClick={() => setShowWidthPicker(!showWidthPicker)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg"
          >
            <div
              className="rounded-full bg-gray-900 dark:bg-white"
              style={{ width: lineWidth * 2, height: lineWidth * 2 }}
            />
            {lineWidth}px
          </button>
          {showWidthPicker && (
            <div className="absolute top-full mt-2 p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10">
              <div className="flex flex-col gap-2">
                {LINE_WIDTHS.map((width) => (
                  <button
                    key={width}
                    onClick={() => {
                      setLineWidth(width);
                      setShowWidthPicker(false);
                    }}
                    className={`flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      lineWidth === width ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div
                      className="rounded-full bg-gray-900 dark:bg-white"
                      style={{ width: width * 2, height: width * 2 }}
                    />
                    <span className="text-sm">{width}px</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drawing Canvas */}
      <div
        ref={containerRef}
        className="border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
          className="cursor-crosshair"
        />
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Draw on the canvas with your mouse, trackpad, or touch screen. Use the eraser to remove
        strokes.
      </p>
    </div>
  );
};
