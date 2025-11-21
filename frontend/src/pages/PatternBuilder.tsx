import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiDownload, FiFileText, FiSave, FiLoader } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../lib/axios';

// Symbol library based on Craft Yarn Council standards
interface SymbolData {
  symbol: string;
  name: string;
  abbr: string;
  desc: string;
  fallback?: string; // ASCII fallback if symbol doesn't render
}

interface SymbolLibrary {
  [category: string]: SymbolData[];
}

const symbolLibrary: SymbolLibrary = {
  basic: [
    { symbol: '□', name: 'Empty', abbr: '', desc: 'Empty stitch', fallback: '.' },
    { symbol: '|', name: 'Knit', abbr: 'K', desc: 'K on RS, P on WS', fallback: 'K' },
    { symbol: '−', name: 'Purl', abbr: 'P', desc: 'P on RS, K on WS', fallback: 'P' },
    { symbol: '○', name: 'Yarn Over', abbr: 'YO', desc: 'Yarn over', fallback: 'O' },
    { symbol: '×', name: 'No Stitch', abbr: '', desc: 'Placeholder - no stitch exists', fallback: 'X' }
  ],
  decreases: [
    { symbol: '⟩', name: 'K2tog', abbr: 'K2tog', desc: 'K2tog on RS, P2tog on WS', fallback: '/' },
    { symbol: '⟨', name: 'SSK', abbr: 'SSK', desc: 'SSK on RS, SSP on WS', fallback: '\\' },
    { symbol: '⟨', name: 'P2tog', abbr: 'P2tog', desc: 'P2tog on RS, K2tog on WS', fallback: '<' },
    { symbol: '⋀', name: 'K3tog', abbr: 'K3tog', desc: 'K3tog on RS, P3tog on WS', fallback: '^' },
    { symbol: '⋏', name: 'SK2P', abbr: 'SK2P', desc: 'Centered double decrease', fallback: 'A' }
  ],
  increases: [
    { symbol: '⋎', name: 'KFB', abbr: 'Kfb', desc: 'K1fb on RS, P1fb on WS', fallback: 'V' },
    { symbol: '⊲', name: 'M1L', abbr: 'M1L', desc: 'Make 1 left', fallback: '<|' },
    { symbol: '⊳', name: 'M1R', abbr: 'M1R', desc: 'Make 1 right', fallback: '|>' },
    { symbol: '⊕', name: 'M1', abbr: 'M1', desc: 'Make 1 knitwise on RS', fallback: '+' }
  ],
  special: [
    { symbol: '⊗', name: 'Bobble', abbr: 'BO', desc: 'Make bobble', fallback: 'B' },
    { symbol: '⊙', name: 'K tbl', abbr: 'Ktbl', desc: 'K1 tbl on RS, P1 tbl on WS', fallback: 'Kt' },
    { symbol: '⊘', name: 'P tbl', abbr: 'Ptbl', desc: 'P1 tbl on RS, K1 tbl on WS', fallback: 'Pt' },
    { symbol: 'V', name: 'Slip', abbr: 'Sl', desc: 'Slip stitch', fallback: 'S' },
    { symbol: '◐', name: 'Wrap', abbr: 'W&T', desc: 'Wrap and turn', fallback: 'W' }
  ],
  cables: [
    { symbol: '⤨', name: '1/1 RC', abbr: '1/1RC', desc: 'Right cross 1 over 1', fallback: 'RC' },
    { symbol: '⤧', name: '1/1 LC', abbr: '1/1LC', desc: 'Left cross 1 over 1', fallback: 'LC' },
    { symbol: '⤪', name: '2/2 RC', abbr: '2/2RC', desc: 'Right cross 2 over 2', fallback: '2R' },
    { symbol: '⤩', name: '2/2 LC', abbr: '2/2LC', desc: 'Left cross 2 over 2', fallback: '2L' }
  ]
};

interface GridData {
  [key: string]: SymbolData;
}

export default function PatternBuilder() {
  const { id: patternId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [selectedSymbol, setSelectedSymbol] = useState<SymbolData>(symbolLibrary.basic[0]);
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
  }, [patternId]);

  const loadExistingChart = async () => {
    if (!patternId) return;

    try {
      // First get the pattern to verify it exists
      const patternResponse = await axios.get(`/api/patterns/${patternId}`);
      if (patternResponse.data.success) {
        setPatternName(patternResponse.data.data.pattern.name || 'Untitled Pattern');
      }

      // Then get any existing charts
      const chartsResponse = await axios.get(`/api/patterns/${patternId}/charts`);
      if (chartsResponse.data.success && chartsResponse.data.data.charts?.length > 0) {
        const chart = chartsResponse.data.data.charts[0]; // Load the first chart
        setChartId(chart.id);
        setRows(chart.rows || 12);
        setCols(chart.cols || 16);

        // Convert chart cells to our gridData format
        if (chart.cells && Array.isArray(chart.cells)) {
          const newGridData: GridData = {};
          chart.cells.forEach((cell: { row: number; col: number; symbol_id?: string }) => {
            const key = `${cell.row}-${cell.col}`;
            // Try to find the symbol in our library
            for (const category of Object.keys(symbolLibrary)) {
              const found = symbolLibrary[category].find(s => s.symbol === cell.symbol_id || s.name === cell.symbol_id);
              if (found) {
                newGridData[key] = found;
                break;
              }
            }
          });
          setGridData(newGridData);
        }
      }
    } catch (error) {
      console.error('Error loading chart:', error);
      // Don't show error for 404 - pattern might not have charts yet
    }
  };

  const placeSymbol = (row: number, col: number, symbolData: SymbolData = selectedSymbol) => {
    const key = `${row}-${col}`;
    setGridData(prev => ({ ...prev, [key]: symbolData }));
  };

  const clearGrid = () => {
    if (window.confirm('Clear entire pattern?')) {
      setGridData({});
    }
  };

  const exportPattern = () => {
    const pattern = {
      name: patternName,
      rows,
      columns: cols,
      data: gridData,
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
  };

  const generateInstructions = () => {
    let instructions = `Pattern: ${patternName}\n\nCast on ${cols} stitches.\n\n`;
    for (let r = 0; r < rows; r++) {
      instructions += `Row ${r + 1}: `;
      const rowInstructions = [];
      for (let c = 0; c < cols; c++) {
        const key = `${r}-${c}`;
        const symbolData = gridData[key] || symbolLibrary.basic[0];
        if (symbolData.abbr) {
          rowInstructions.push(symbolData.abbr);
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

      // Convert gridData to chartData format for backend
      const chartData = Object.entries(gridData).map(([key, symbolData]) => {
        const [row, col] = key.split('-').map(Number);
        return {
          row,
          col,
          symbol: symbolData.symbol,
          name: symbolData.name,
          abbr: symbolData.abbr,
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

  // Improved search - searches name, abbreviation, and description
  const filteredSymbols = (category: string): SymbolData[] => {
    const query = searchQuery.toLowerCase();
    return symbolLibrary[category].filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.abbr.toLowerCase().includes(query) ||
      s.desc.toLowerCase().includes(query) ||
      s.symbol.includes(searchQuery)
    );
  };

  // Render a stitch symbol with fallback support
  const renderSymbol = (symbolData: SymbolData, size: 'lg' | 'xl' | '2xl' = '2xl') => {
    const sizeClass = size === 'lg' ? 'stitch-symbol-lg' : size === 'xl' ? 'stitch-symbol-xl' : 'stitch-symbol-2xl';
    return (
      <span
        className={`stitch-symbol ${sizeClass} select-none text-gray-900 dark:text-gray-100`}
        data-fallback={symbolData.fallback}
        title={`${symbolData.name}${symbolData.abbr ? ` (${symbolData.abbr})` : ''}`}
      >
        {symbolData.symbol}
      </span>
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
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🧶</span>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Symbol Palette</h2>
          </div>

          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
            placeholder="Search symbols..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="space-y-4">
            {Object.keys(symbolLibrary).map(category => (
              <div key={category}>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  {category}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {filteredSymbols(category).map((symbolData, idx) => (
                    <div
                      key={idx}
                      className={`aspect-square border rounded-lg flex items-center justify-center cursor-pointer transition-all hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-purple-500 hover:scale-105 ${
                        selectedSymbol === symbolData ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30' : 'border-gray-200 dark:border-gray-600'
                      }`}
                      onClick={() => setSelectedSymbol(symbolData)}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('symbol', JSON.stringify(symbolData))}
                      title={`${symbolData.name}${symbolData.abbr ? ` (${symbolData.abbr})` : ''}: ${symbolData.desc}`}
                    >
                      {renderSymbol(symbolData, 'xl')}
                    </div>
                  ))}
                </div>
              </div>
            ))}
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

                return (
                  <div
                    key={key}
                    className={`w-10 h-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      cellData ? 'bg-purple-50 dark:bg-purple-900/30' : ''
                    }`}
                    onClick={() => placeSymbol(r, c)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const symbolData = JSON.parse(e.dataTransfer.getData('symbol'));
                      placeSymbol(r, c, symbolData);
                    }}
                    title={cellData ? `${cellData.name}${cellData.abbr ? ` (${cellData.abbr})` : ''}` : 'Empty cell'}
                  >
                    {cellData && (
                      <span className="stitch-symbol stitch-symbol-xl pointer-events-none text-gray-900 dark:text-gray-100">{cellData.symbol}</span>
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
                    <div className="text-xs text-gray-600 dark:text-gray-400">{selectedSymbol.desc}</div>
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
                  {Object.keys(gridData).filter(key => gridData[key].symbol !== '□').length}
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
