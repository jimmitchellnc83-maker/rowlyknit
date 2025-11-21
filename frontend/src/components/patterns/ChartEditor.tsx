import { useState, useEffect, useRef } from 'react';
import { FiSave, FiX, FiPlus, FiMinus, FiGrid, FiEdit3, FiTrash2, FiRotateCcw, FiRotateCw } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';

interface ChartSymbol {
  id: string;
  symbol: string;
  name: string;
  description: string;
  color?: string;
  category: string;
}

interface ChartCell {
  row: number;
  col: number;
  symbol: string;
}

interface ChartData {
  id?: string;
  title: string;
  rows: number;
  cols: number;
  isInTheRound: boolean;
  notes?: string;
  chartData: ChartCell[];
  symbols: ChartSymbol[];
}

interface ChartEditorProps {
  patternId: string;
  chartData?: ChartData;
  onSave?: () => void;
  onCancel?: () => void;
}

type Tool = 'pencil' | 'eraser' | 'fill';

export function ChartEditor({ patternId, chartData, onSave, onCancel }: ChartEditorProps) {
  const [title, setTitle] = useState(chartData?.title || '');
  const [rows, setRows] = useState(chartData?.rows || 20);
  const [cols, setCols] = useState(chartData?.cols || 20);
  const [isInTheRound, setIsInTheRound] = useState(chartData?.isInTheRound || false);
  const [notes, setNotes] = useState(chartData?.notes || '');
  const [cells, setCells] = useState<ChartCell[]>(chartData?.chartData || []);
  const [availableSymbols, setAvailableSymbols] = useState<ChartSymbol[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<ChartSymbol | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('pencil');
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ChartCell[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSymbols();
  }, []);

  useEffect(() => {
    // Initialize history
    if (history.length === 0) {
      setHistory([cells]);
      setHistoryIndex(0);
    }
  }, []);

  const fetchSymbols = async () => {
    try {
      const response = await axios.get('/api/chart-symbols');
      const symbols = response.data.data.symbols;
      setAvailableSymbols(symbols);
      if (symbols.length > 0 && !selectedSymbol) {
        setSelectedSymbol(symbols[0]);
      }
    } catch (error) {
      console.error('Error fetching symbols:', error);
      toast.error('Failed to load chart symbols');
    }
  };

  const addToHistory = (newCells: ChartCell[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newCells);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCells(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCells(history[historyIndex + 1]);
    }
  };

  const getCellSymbol = (row: number, col: number): string | null => {
    const cell = cells.find(c => c.row === row && c.col === col);
    return cell?.symbol || null;
  };

  const handleCellClick = (row: number, col: number) => {
    if (activeTool === 'pencil' && selectedSymbol) {
      const newCells = cells.filter(c => !(c.row === row && c.col === col));
      newCells.push({ row, col, symbol: selectedSymbol.id });
      setCells(newCells);
      addToHistory(newCells);
    } else if (activeTool === 'eraser') {
      const newCells = cells.filter(c => !(c.row === row && c.col === col));
      setCells(newCells);
      addToHistory(newCells);
    } else if (activeTool === 'fill' && selectedSymbol) {
      // Fill all empty cells with selected symbol
      const newCells = [...cells];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!getCellSymbol(r, c)) {
            newCells.push({ row: r, col: c, symbol: selectedSymbol.id });
          }
        }
      }
      setCells(newCells);
      addToHistory(newCells);
    }
  };

  const handleMouseDown = (row: number, col: number) => {
    setIsDrawing(true);
    handleCellClick(row, col);
  };

  const handleMouseEnter = (row: number, col: number) => {
    if (isDrawing) {
      handleCellClick(row, col);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Chart title is required');
      return;
    }

    if (rows < 1 || rows > 1000) {
      toast.error('Rows must be between 1 and 1000');
      return;
    }

    if (cols < 1 || cols > 1000) {
      toast.error('Columns must be between 1 and 1000');
      return;
    }

    setSaving(true);

    try {
      const usedSymbolIds = [...new Set(cells.map(c => c.symbol))];
      const payload = {
        title,
        rows,
        cols,
        isInTheRound,
        notes,
        chartData: cells,
        symbolIds: usedSymbolIds,
      };

      if (chartData?.id) {
        // Update existing chart
        await axios.put(`/api/patterns/${patternId}/charts/${chartData.id}`, payload);
        toast.success('Chart updated successfully');
      } else {
        // Create new chart
        await axios.post(`/api/patterns/${patternId}/charts`, payload);
        toast.success('Chart created successfully');
      }

      onSave?.();
    } catch (error: any) {
      console.error('Error saving chart:', error);
      toast.error(error.response?.data?.message || 'Failed to save chart');
    } finally {
      setSaving(false);
    }
  };

  const handleGridResize = (newRows: number, newCols: number) => {
    if (newRows < 1 || newRows > 1000 || newCols < 1 || newCols > 1000) {
      toast.error('Grid size must be between 1 and 1000');
      return;
    }

    // Filter out cells that are outside new grid bounds
    const newCells = cells.filter(c => c.row < newRows && c.col < newCols);
    setCells(newCells);
    addToHistory(newCells);
    setRows(newRows);
    setCols(newCols);
  };

  const clearChart = () => {
    if (window.confirm('Are you sure you want to clear the entire chart?')) {
      setCells([]);
      addToHistory([]);
    }
  };

  const renderGrid = () => {
    const grid = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellSymbolId = getCellSymbol(r, c);
        const symbol = cellSymbolId
          ? availableSymbols.find(s => s.id === cellSymbolId)
          : null;

        grid.push(
          <div
            key={`${r}-${c}`}
            className="chart-cell"
            style={{
              backgroundColor: symbol?.color || '#fff',
              border: '1px solid #ddd',
              cursor: 'pointer',
              fontSize: `${12 * zoom}px`,
              width: `${20 * zoom}px`,
              height: `${20 * zoom}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
            }}
            onMouseDown={() => handleMouseDown(r, c)}
            onMouseEnter={() => handleMouseEnter(r, c)}
            onMouseUp={handleMouseUp}
          >
            {symbol?.symbol}
          </div>
        );
      }
    }
    return grid;
  };

  const renderSymbolPalette = () => {
    const categories = [...new Set(availableSymbols.map(s => s.category))];

    return categories.map(category => (
      <div key={category} className="mb-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2 capitalize">{category}</h4>
        <div className="grid grid-cols-4 gap-2">
          {availableSymbols
            .filter(s => s.category === category)
            .map(symbol => (
              <button
                key={symbol.id}
                onClick={() => setSelectedSymbol(symbol)}
                className={`p-2 border rounded hover:bg-gray-100 transition ${
                  selectedSymbol?.id === symbol.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
                style={{ backgroundColor: symbol.color || '#fff' }}
                title={`${symbol.name} - ${symbol.description}`}
              >
                <div className="text-xl">{symbol.symbol}</div>
                <div className="text-xs mt-1 text-gray-600">{symbol.name}</div>
              </button>
            ))}
        </div>
      </div>
    ));
  };

  return (
    <div className="chart-editor bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {chartData?.id ? 'Edit Chart' : 'Create New Chart'}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <FiSave />
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            <FiX />
            Cancel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Chart Settings */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Chart Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Main Cable Pattern"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rows</label>
              <input
                type="number"
                value={rows}
                onChange={(e) => handleGridResize(parseInt(e.target.value) || 1, cols)}
                min="1"
                max="1000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Columns</label>
              <input
                type="number"
                value={cols}
                onChange={(e) => handleGridResize(rows, parseInt(e.target.value) || 1)}
                min="1"
                max="1000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isInTheRound}
                onChange={(e) => setIsInTheRound(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">Knit in the round</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Add notes about this chart..."
            />
          </div>

          {/* Tools */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tools</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setActiveTool('pencil')}
                className={`p-2 border rounded-lg flex flex-col items-center gap-1 ${
                  activeTool === 'pencil' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
              >
                <FiEdit3 />
                <span className="text-xs">Pencil</span>
              </button>
              <button
                onClick={() => setActiveTool('eraser')}
                className={`p-2 border rounded-lg flex flex-col items-center gap-1 ${
                  activeTool === 'eraser' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
              >
                <FiTrash2 />
                <span className="text-xs">Eraser</span>
              </button>
              <button
                onClick={() => setActiveTool('fill')}
                className={`p-2 border rounded-lg flex flex-col items-center gap-1 ${
                  activeTool === 'fill' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
              >
                <FiGrid />
                <span className="text-xs">Fill</span>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="flex-1 p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center gap-1"
              title="Undo"
            >
              <FiRotateCcw />
              Undo
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="flex-1 p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center gap-1"
              title="Redo"
            >
              <FiRotateCw />
              Redo
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              className="flex-1 p-2 border border-gray-300 rounded-lg hover:bg-gray-100 flex items-center justify-center gap-1"
            >
              <FiMinus />
              Zoom Out
            </button>
            <button
              onClick={() => setZoom(Math.min(2, zoom + 0.25))}
              className="flex-1 p-2 border border-gray-300 rounded-lg hover:bg-gray-100 flex items-center justify-center gap-1"
            >
              <FiPlus />
              Zoom In
            </button>
          </div>

          <button
            onClick={clearChart}
            className="w-full p-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 flex items-center justify-center gap-1"
          >
            <FiTrash2 />
            Clear Chart
          </button>

          {/* Symbol Palette */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Symbol Palette</h3>
            <div className="max-h-96 overflow-y-auto">
              {renderSymbolPalette()}
            </div>
          </div>
        </div>

        {/* Right Panel - Chart Grid */}
        <div className="lg:col-span-2">
          <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">Chart Grid</h3>
              <div className="text-sm text-gray-600">
                {rows} × {cols} ({cells.length} cells filled)
              </div>
            </div>

            <div
              ref={canvasRef}
              className="overflow-auto max-h-[600px] bg-white border border-gray-200 rounded"
              onMouseLeave={handleMouseUp}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${cols}, ${20 * zoom}px)`,
                  gap: 0,
                  width: 'fit-content',
                }}
              >
                {renderGrid()}
              </div>
            </div>

            {selectedSymbol && activeTool === 'pencil' && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-2xl" style={{ backgroundColor: selectedSymbol.color }}>
                    {selectedSymbol.symbol}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800">{selectedSymbol.name}</div>
                    <div className="text-sm text-gray-600">{selectedSymbol.description}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
