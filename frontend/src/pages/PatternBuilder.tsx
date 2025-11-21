import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiDownload, FiFileText, FiSave, FiLoader, FiGrid } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../lib/axios';

// Import comprehensive symbol library
import {
  KNITTING_SYMBOLS,
  SymbolData,
  getCategories,
  searchSymbols,
  DEFAULT_SYMBOL,
  TOTAL_SYMBOL_COUNT,
} from '../data/knitting-symbols-library';

interface GridCell {
  symbol: SymbolData;
  isOccupied?: boolean; // For multi-width cables
  parentKey?: string;   // Reference to the parent cell for multi-width symbols
}

interface GridData {
  [key: string]: GridCell;
}

export default function PatternBuilder() {
  const { id: patternId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chartIdFromUrl = searchParams.get('chart');

  // Get all categories for tabs
  const categories = getCategories();

  const [selectedSymbol, setSelectedSymbol] = useState<SymbolData>(DEFAULT_SYMBOL);
  const [selectedCategory, setSelectedCategory] = useState('basic');
  const [gridData, setGridData] = useState<GridData>({});
  const [rows, setRows] = useState(12);
  const [cols, setCols] = useState(16);
  const [patternName, setPatternName] = useState('Untitled Pattern');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [chartId, setChartId] = useState<string | null>(null);
  const [currentPatternId, setCurrentPatternId] = useState<string | null>(patternId || null);

  // Load existing chart data if editing an existing pattern
  useEffect(() => {
    if (patternId) {
      loadExistingChart();
    }
  }, [patternId, chartIdFromUrl]);

  // Helper to parse chart data (handles both array and string formats for backwards compatibility)
  const parseChartData = (chartData: unknown): Array<{ row: number; col: number; symbol: string; name?: string; abbr?: string; width?: number }> => {
    if (!chartData) return [];
    if (Array.isArray(chartData)) return chartData;
    // Handle double-encoded JSON (backwards compatibility)
    if (typeof chartData === 'string') {
      try {
        return JSON.parse(chartData);
      } catch {
        return [];
      }
    }
    return [];
  };

  // Helper to convert chart data to grid data
  const convertChartDataToGrid = (chartData: unknown) => {
    const data = parseChartData(chartData);
    if (data.length === 0) return;

    const newGridData: GridData = {};
    data.forEach((cell) => {
      const key = `${cell.row}-${cell.col}`;
      // Try to find the symbol in our library by symbol character or name
      let foundSymbol: SymbolData | undefined;
      for (const category of Object.keys(KNITTING_SYMBOLS)) {
        foundSymbol = KNITTING_SYMBOLS[category].symbols.find(
          s => s.symbol === cell.symbol || s.name === cell.name || s.abbr === cell.abbr
        );
        if (foundSymbol) break;
      }
      if (foundSymbol) {
        newGridData[key] = { symbol: foundSymbol };
        // Handle multi-width symbols
        const width = cell.width || foundSymbol.width || 1;
        if (width > 1) {
          for (let i = 1; i < width; i++) {
            const occupiedKey = `${cell.row}-${cell.col + i}`;
            newGridData[occupiedKey] = { symbol: foundSymbol, isOccupied: true, parentKey: key };
          }
        }
      }
    });
    setGridData(newGridData);
  };

  const loadExistingChart = async () => {
    if (!patternId) return;

    try {
      // First get the pattern to verify it exists
      const patternResponse = await axios.get(`/api/patterns/${patternId}`);
      if (patternResponse.data.success) {
        setPatternName(patternResponse.data.data.pattern.name || 'Untitled Pattern');
      }

      // If specific chart ID provided, load that chart
      if (chartIdFromUrl) {
        const chartResponse = await axios.get(`/api/patterns/${patternId}/charts/${chartIdFromUrl}`);
        if (chartResponse.data.success && chartResponse.data.data.chart) {
          const chart = chartResponse.data.data.chart;
          setChartId(chart.id);
          setPatternName(chart.title || patternName);
          setRows(chart.rows || 12);
          setCols(chart.cols || 16);
          convertChartDataToGrid(chart.chart_data || chart.chartData);
        }
      } else {
        // Otherwise get all charts and load the first one
        const chartsResponse = await axios.get(`/api/patterns/${patternId}/charts`);
        if (chartsResponse.data.success && chartsResponse.data.data.charts?.length > 0) {
          const chart = chartsResponse.data.data.charts[0];
          setChartId(chart.id);
          setPatternName(chart.title || patternName);
          setRows(chart.rows || 12);
          setCols(chart.cols || 16);
          convertChartDataToGrid(chart.chart_data);
        }
      }
    } catch (error) {
      console.error('Error loading chart:', error);
      // Don't show error for 404 - pattern might not have charts yet
    }
  };

  const placeSymbol = (row: number, col: number, symbolData: SymbolData = selectedSymbol) => {
    const key = `${row}-${col}`;
    const symbolWidth = symbolData.width || 1;

    // Check if symbol fits in the row
    if (col + symbolWidth > cols) {
      toast.warning(`This ${symbolData.name} symbol needs ${symbolWidth} stitches but only ${cols - col} available`);
      return;
    }

    // Check if any cells would be occupied by an existing multi-width symbol
    const existingCell = gridData[key];
    if (existingCell?.isOccupied && existingCell.parentKey) {
      // Clear the parent symbol first
      const parentKey = existingCell.parentKey;
      const parentCell = gridData[parentKey];
      if (parentCell) {
        const parentWidth = parentCell.symbol.width || 1;
        setGridData(prev => {
          const newData = { ...prev };
          for (let i = 0; i < parentWidth; i++) {
            const [pRow, pCol] = parentKey.split('-').map(Number);
            delete newData[`${pRow}-${pCol + i}`];
          }
          return newData;
        });
      }
    }

    setGridData(prev => {
      const newData = { ...prev };

      // Place the main symbol
      newData[key] = { symbol: symbolData };

      // For multi-width symbols, mark occupied cells
      if (symbolWidth > 1) {
        for (let i = 1; i < symbolWidth; i++) {
          const occupiedKey = `${row}-${col + i}`;
          newData[occupiedKey] = { symbol: symbolData, isOccupied: true, parentKey: key };
        }
      }

      return newData;
    });
  };

  const clearGrid = () => {
    if (window.confirm('Clear entire pattern?')) {
      setGridData({});
    }
  };

  const exportPattern = () => {
    // Convert gridData to export format
    const exportData = Object.entries(gridData)
      .filter(([_, cell]) => !cell.isOccupied) // Only export non-occupied cells
      .map(([key, cell]) => {
        const [row, col] = key.split('-').map(Number);
        return {
          row,
          col,
          symbol: cell.symbol.symbol,
          name: cell.symbol.name,
          abbr: cell.symbol.abbr,
          width: cell.symbol.width || 1,
        };
      });

    const pattern = {
      name: patternName,
      rows,
      columns: cols,
      totalSymbols: TOTAL_SYMBOL_COUNT,
      data: exportData,
      created: new Date().toISOString()
    };
    const json = JSON.stringify(pattern, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${patternName.replace(/\s+/g, '-').toLowerCase()}-pattern.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Pattern exported successfully!');
  };

  const generateInstructions = () => {
    let instructions = `Pattern: ${patternName}\n\nCast on ${cols} stitches.\n\n`;
    for (let r = 0; r < rows; r++) {
      instructions += `Row ${r + 1}: `;
      const rowInstructions: string[] = [];
      let c = 0;
      while (c < cols) {
        const key = `${r}-${c}`;
        const cell = gridData[key];
        if (cell && !cell.isOccupied) {
          if (cell.symbol.abbr) {
            rowInstructions.push(cell.symbol.abbr);
          }
          // Skip over multi-width symbol cells
          c += cell.symbol.width || 1;
        } else if (!cell || cell.isOccupied) {
          c++;
        }
      }
      instructions += rowInstructions.join(', ') || 'Empty row';
      instructions += '\n';
    }
    // Copy to clipboard and show toast notification
    navigator.clipboard.writeText(instructions).then(() => {
      toast.success('Pattern instructions copied to clipboard!');
    }).catch(() => {
      // Fallback: show in console and toast
      console.log(instructions);
      toast.info('Pattern instructions generated - check browser console');
    });
  };

  const savePattern = async () => {
    if (!patternName.trim()) {
      toast.error('Please enter a pattern name');
      return;
    }

    setSaving(true);

    try {
      let targetPatternId = currentPatternId;

      // If no pattern exists yet, create one first
      if (!targetPatternId) {
        const patternResponse = await axios.post('/api/patterns', {
          name: patternName,
          description: 'Created with Pattern Builder',
          category: 'custom',
        });

        if (patternResponse.data.success) {
          targetPatternId = patternResponse.data.data.pattern.id;
          setCurrentPatternId(targetPatternId);
        } else {
          throw new Error('Failed to create pattern');
        }
      }

      // Convert gridData to chartData format for backend (exclude occupied cells)
      const chartData = Object.entries(gridData)
        .filter(([_, cell]) => !cell.isOccupied)
        .map(([key, cell]) => {
          const [row, col] = key.split('-').map(Number);
          return {
            row,
            col,
            symbol: cell.symbol.symbol,
            name: cell.symbol.name,
            abbr: cell.symbol.abbr,
            width: cell.symbol.width || 1,
          };
        });

      // Save or update the chart
      if (chartId) {
        // Update existing chart
        await axios.put(`/api/patterns/${targetPatternId}/charts/${chartId}`, {
          title: patternName,
          rows,
          cols,
          chartData,
          notes: `Pattern with ${Object.keys(gridData).length} stitches`,
        });
        toast.success('Pattern updated successfully!');
      } else {
        // Create new chart
        const chartResponse = await axios.post(`/api/patterns/${targetPatternId}/charts`, {
          title: patternName,
          rows,
          cols,
          chartData,
          notes: `Pattern with ${Object.keys(gridData).length} stitches`,
        });

        if (chartResponse.data.success) {
          setChartId(chartResponse.data.data.chart.id);
        }
        toast.success('Pattern saved to your library!');
      }

      // Also save to localStorage as backup
      const pattern = {
        name: patternName,
        rows,
        columns: cols,
        data: gridData,
        patternId: targetPatternId,
        chartId: chartId,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem('rowly-pattern-backup', JSON.stringify(pattern));
    } catch (error: any) {
      console.error('Error saving pattern:', error);
      toast.error(error.response?.data?.message || 'Failed to save pattern. Please try again.');

      // Fall back to localStorage on error
      const pattern = {
        name: patternName,
        rows,
        columns: cols,
        data: gridData
      };
      const patterns = JSON.parse(localStorage.getItem('rowly-patterns') || '[]');
      patterns.push(pattern);
      localStorage.setItem('rowly-patterns', JSON.stringify(patterns));
      toast.info('Pattern saved locally as backup.');
    } finally {
      setSaving(false);
    }
  };

  // Get symbols for the current category or search results
  const getDisplaySymbols = (): SymbolData[] => {
    if (searchQuery.trim()) {
      return searchSymbols(searchQuery);
    }
    return KNITTING_SYMBOLS[selectedCategory]?.symbols || [];
  };

  // Handle category change
  const handleCategoryChange = (categoryKey: string) => {
    setSelectedCategory(categoryKey);
    setSearchQuery('');
  };

  // Render a stitch symbol with fallback support
  const renderSymbol = (symbolData: SymbolData, size: 'lg' | 'xl' | '2xl' = '2xl') => {
    const sizeClass = size === 'lg' ? 'stitch-symbol-lg' : size === 'xl' ? 'stitch-symbol-xl' : 'stitch-symbol-2xl';
    const widthBadge = symbolData.width && symbolData.width > 1 ? (
      <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
        {symbolData.width}
      </span>
    ) : null;

    return (
      <div className="relative inline-flex items-center justify-center">
        <span
          className={`stitch-symbol ${sizeClass} select-none text-gray-900 dark:text-gray-100`}
          data-fallback={symbolData.fallback}
          title={`${symbolData.name}${symbolData.abbr ? ` (${symbolData.abbr})` : ''}${symbolData.width ? ` - ${symbolData.width} sts wide` : ''}`}
        >
          {symbolData.symbol}
        </span>
        {widthBadge}
      </div>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(currentPatternId ? `/patterns/${currentPatternId}` : '/patterns')}
          className="flex items-center text-purple-600 hover:text-purple-700 mb-4 min-h-[48px]"
        >
          <FiArrowLeft className="mr-2 h-5 w-5" />
          <span className="text-base">{currentPatternId ? 'Back to Pattern' : 'Back to Patterns'}</span>
        </button>

        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Knitting Pattern Builder</h1>
        <p className="text-gray-600 dark:text-gray-400">Create and design custom knitting patterns with standard stitch symbols</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-4">
        {/* Symbol Palette */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <FiGrid className="text-purple-600 w-5 h-5" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Symbol Palette</h2>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">{TOTAL_SYMBOL_COUNT} symbols</span>
          </div>

          {/* Search */}
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-3"
            placeholder="Search all symbols..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Category Tabs */}
          <div className="mb-3 -mx-1">
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1">
              {categories.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => handleCategoryChange(cat.key)}
                  className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat.key && !searchQuery
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-gray-600'
                  }`}
                  title={cat.description}
                >
                  {cat.name} ({cat.count})
                </button>
              ))}
            </div>
          </div>

          {/* Symbols Grid */}
          <div className="max-h-[400px] overflow-y-auto pr-1">
            {searchQuery ? (
              // Search results mode
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {getDisplaySymbols().length} results for "{searchQuery}"
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {getDisplaySymbols().map((symbolData) => (
                    <div
                      key={symbolData.id}
                      className={`aspect-square border rounded-lg flex items-center justify-center cursor-pointer transition-all hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-purple-500 hover:scale-105 ${
                        selectedSymbol.id === symbolData.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30' : 'border-gray-200 dark:border-gray-600'
                      }`}
                      onClick={() => setSelectedSymbol(symbolData)}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('symbol', JSON.stringify(symbolData))}
                      title={`${symbolData.name}${symbolData.abbr ? ` (${symbolData.abbr})` : ''}: ${symbolData.description}`}
                    >
                      {renderSymbol(symbolData, 'xl')}
                    </div>
                  ))}
                </div>
                {getDisplaySymbols().length === 0 && (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    No symbols found for "{searchQuery}"
                  </div>
                )}
              </div>
            ) : (
              // Category mode
              <div>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  {KNITTING_SYMBOLS[selectedCategory]?.name}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {getDisplaySymbols().map((symbolData) => (
                    <div
                      key={symbolData.id}
                      className={`aspect-square border rounded-lg flex items-center justify-center cursor-pointer transition-all hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-purple-500 hover:scale-105 ${
                        selectedSymbol.id === symbolData.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30' : 'border-gray-200 dark:border-gray-600'
                      }`}
                      onClick={() => setSelectedSymbol(symbolData)}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('symbol', JSON.stringify(symbolData))}
                      title={`${symbolData.name}${symbolData.abbr ? ` (${symbolData.abbr})` : ''}: ${symbolData.description}`}
                    >
                      {renderSymbol(symbolData, 'xl')}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pattern Grid */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">📋</span>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pattern Chart</h2>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Rows:</label>
              <input
                type="number"
                value={rows}
                onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded focus:ring-2 focus:ring-purple-500"
                min="1"
                max="100"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Stitches:</label>
              <input
                type="number"
                value={cols}
                onChange={(e) => setCols(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded focus:ring-2 focus:ring-purple-500"
                min="1"
                max="100"
              />
            </div>
            <button
              onClick={clearGrid}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition text-sm"
            >
              Clear
            </button>
          </div>

          <div className="overflow-auto max-h-[600px] border-2 border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
            <div
              className="inline-grid gap-px bg-gray-300 dark:bg-gray-600 border border-gray-300 dark:border-gray-600"
              style={{
                gridTemplateColumns: `repeat(${cols}, 40px)`,
                gridTemplateRows: `repeat(${rows}, 40px)`
              }}
            >
              {Array.from({ length: rows * cols }).map((_, index) => {
                const r = Math.floor(index / cols);
                const c = index % cols;
                const key = `${r}-${c}`;
                const cellData = gridData[key];
                const isOccupied = cellData?.isOccupied;
                const symbolData = cellData?.symbol;

                return (
                  <div
                    key={key}
                    className={`w-10 h-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      cellData && !isOccupied ? 'bg-purple-50 dark:bg-purple-900/30' : ''
                    } ${isOccupied ? 'bg-purple-100 dark:bg-purple-800/40 opacity-60' : ''}`}
                    onClick={() => placeSymbol(r, c)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const droppedSymbol = JSON.parse(e.dataTransfer.getData('symbol'));
                      placeSymbol(r, c, droppedSymbol);
                    }}
                    title={isOccupied ? 'Part of multi-stitch symbol' : (symbolData ? `${symbolData.name}${symbolData.abbr ? ` (${symbolData.abbr})` : ''}` : 'Empty cell')}
                  >
                    {cellData && !isOccupied && symbolData && (
                      <span
                        className="stitch-symbol stitch-symbol-xl pointer-events-none text-gray-900 dark:text-gray-100"
                        data-fallback={symbolData.fallback}
                      >
                        {symbolData.symbol}
                      </span>
                    )}
                    {isOccupied && (
                      <span className="text-purple-400 dark:text-purple-500 text-xs">...</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Properties Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">⚙️</span>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pattern Info</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Pattern Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="My Pattern"
                value={patternName}
                onChange={(e) => setPatternName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Selected Symbol
              </label>
              <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <div className="flex items-center gap-3">
                  {renderSymbol(selectedSymbol, '2xl')}
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                      {selectedSymbol.name}
                      {selectedSymbol.abbr && (
                        <span className="ml-1 text-xs font-normal text-purple-600 dark:text-purple-400">({selectedSymbol.abbr})</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">{selectedSymbol.description}</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Stitch Count
              </label>
              <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Stitches:</span>
                <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {Object.keys(gridData).filter(key => !gridData[key].isOccupied && gridData[key].symbol.symbol !== '□').length}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Pattern Stats
              </label>
              <div className="text-sm space-y-2">
                <div className="flex justify-between py-1">
                  <span className="text-gray-600 dark:text-gray-400">Rows:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{rows}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-600 dark:text-gray-400">Stitches per row:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{cols}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-600 dark:text-gray-400">Total cells:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{rows * cols}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-4">
              <button
                onClick={exportPattern}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                <FiDownload />
                Export Pattern
              </button>
              <button
                onClick={generateInstructions}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition"
              >
                <FiFileText />
                Generate Instructions
              </button>
              <button
                onClick={savePattern}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <FiLoader className="animate-spin" /> : <FiSave />}
                {saving ? 'Saving...' : 'Save to Library'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
