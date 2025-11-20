import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiDownload, FiFileText, FiSave } from 'react-icons/fi';

// Symbol library based on Craft Yarn Council standards
interface SymbolData {
  symbol: string;
  name: string;
  abbr: string;
  desc: string;
}

interface SymbolLibrary {
  [category: string]: SymbolData[];
}

const symbolLibrary: SymbolLibrary = {
  basic: [
    { symbol: '□', name: 'Empty', abbr: '', desc: 'Empty stitch' },
    { symbol: '|', name: 'Knit', abbr: 'K', desc: 'K on RS, P on WS' },
    { symbol: '−', name: 'Purl', abbr: 'P', desc: 'P on RS, K on WS' },
    { symbol: '○', name: 'Yarn Over', abbr: 'YO', desc: 'Yarn over' },
    { symbol: '×', name: 'No Stitch', abbr: '', desc: 'Placeholder - no stitch exists' }
  ],
  decreases: [
    { symbol: '⟩', name: 'K2tog', abbr: 'K2tog', desc: 'K2tog on RS, P2tog on WS' },
    { symbol: '⟨', name: 'SSK', abbr: 'SSK', desc: 'SSK on RS, SSP on WS' },
    { symbol: '⟨', name: 'P2tog', abbr: 'P2tog', desc: 'P2tog on RS, K2tog on WS' },
    { symbol: '⋀', name: 'K3tog', abbr: 'K3tog', desc: 'K3tog on RS, P3tog on WS' },
    { symbol: '⋏', name: 'SK2P', abbr: 'SK2P', desc: 'Centered double decrease' }
  ],
  increases: [
    { symbol: '⋎', name: 'KFB', abbr: 'Kfb', desc: 'K1fb on RS, P1fb on WS' },
    { symbol: '⊲', name: 'M1L', abbr: 'M1L', desc: 'Make 1 left' },
    { symbol: '⊳', name: 'M1R', abbr: 'M1R', desc: 'Make 1 right' },
    { symbol: '⊕', name: 'M1', abbr: 'M1', desc: 'Make 1 knitwise on RS' }
  ],
  special: [
    { symbol: '⊗', name: 'Bobble', abbr: 'BO', desc: 'Make bobble' },
    { symbol: '⊙', name: 'K tbl', abbr: 'Ktbl', desc: 'K1 tbl on RS, P1 tbl on WS' },
    { symbol: '⊘', name: 'P tbl', abbr: 'Ptbl', desc: 'P1 tbl on RS, K1 tbl on WS' },
    { symbol: 'V', name: 'Slip', abbr: 'Sl', desc: 'Slip stitch' },
    { symbol: '◐', name: 'Wrap', abbr: 'W&T', desc: 'Wrap and turn' }
  ],
  cables: [
    { symbol: '⤨', name: '1/1 RC', abbr: '1/1RC', desc: 'Right cross 1 over 1' },
    { symbol: '⤧', name: '1/1 LC', abbr: '1/1LC', desc: 'Left cross 1 over 1' },
    { symbol: '⤪', name: '2/2 RC', abbr: '2/2RC', desc: 'Right cross 2 over 2' },
    { symbol: '⤩', name: '2/2 LC', abbr: '2/2LC', desc: 'Left cross 2 over 2' }
  ]
};

interface GridData {
  [key: string]: SymbolData;
}

export default function PatternBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [selectedSymbol, setSelectedSymbol] = useState<SymbolData>(symbolLibrary.basic[0]);
  const [gridData, setGridData] = useState<GridData>({});
  const [rows, setRows] = useState(12);
  const [cols, setCols] = useState(16);
  const [patternName, setPatternName] = useState('Untitled Pattern');
  const [searchQuery, setSearchQuery] = useState('');

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
    alert(instructions);
  };

  const savePattern = () => {
    const pattern = {
      name: patternName,
      rows,
      columns: cols,
      data: gridData
    };
    const patterns = JSON.parse(localStorage.getItem('rowly-patterns') || '[]');
    patterns.push(pattern);
    localStorage.setItem('rowly-patterns', JSON.stringify(patterns));
    alert('Pattern saved successfully!');
  };

  const filteredSymbols = (category: string): SymbolData[] => {
    return symbolLibrary[category].filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(`/patterns/${id}`)}
          className="flex items-center text-purple-600 hover:text-purple-700 mb-4 min-h-[48px]"
        >
          <FiArrowLeft className="mr-2 h-5 w-5" />
          <span className="text-base">Back to Pattern</span>
        </button>

        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Knitting Pattern Builder</h1>
        <p className="text-gray-600">Create and design custom knitting patterns with standard stitch symbols</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-4">
        {/* Symbol Palette */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🧶</span>
            <h2 className="text-lg font-semibold text-gray-900">Symbol Palette</h2>
          </div>

          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
            placeholder="Search symbols..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="space-y-4">
            {Object.keys(symbolLibrary).map(category => (
              <div key={category}>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {category}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {filteredSymbols(category).map((symbolData, idx) => (
                    <div
                      key={idx}
                      className={`aspect-square border rounded-lg flex items-center justify-center cursor-pointer transition-all hover:bg-gray-100 hover:border-purple-500 hover:scale-105 ${
                        selectedSymbol === symbolData ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                      }`}
                      onClick={() => setSelectedSymbol(symbolData)}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('symbol', JSON.stringify(symbolData))}
                      title={symbolData.name}
                    >
                      <span className="text-2xl select-none">{symbolData.symbol}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pattern Grid */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">📋</span>
            <h2 className="text-lg font-semibold text-gray-900">Pattern Chart</h2>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Rows:</label>
              <input
                type="number"
                value={rows}
                onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                className="w-16 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                min="1"
                max="100"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Stitches:</label>
              <input
                type="number"
                value={cols}
                onChange={(e) => setCols(parseInt(e.target.value) || 1)}
                className="w-16 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                min="1"
                max="100"
              />
            </div>
            <button
              onClick={clearGrid}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm"
            >
              Clear
            </button>
          </div>

          <div className="overflow-auto max-h-[600px] border-2 border-gray-300 rounded-lg p-4">
            <div
              className="inline-grid gap-px bg-gray-300 border border-gray-300"
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
                    className={`w-10 h-10 bg-white border border-gray-200 flex items-center justify-center cursor-pointer transition-colors hover:bg-gray-100 ${
                      cellData ? 'bg-purple-50' : ''
                    }`}
                    onClick={() => placeSymbol(r, c)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const symbolData = JSON.parse(e.dataTransfer.getData('symbol'));
                      placeSymbol(r, c, symbolData);
                    }}
                    title={cellData?.name}
                  >
                    {cellData && (
                      <span className="text-2xl select-none pointer-events-none">{cellData.symbol}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Properties Panel */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">⚙️</span>
            <h2 className="text-lg font-semibold text-gray-900">Pattern Info</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                Pattern Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="My Pattern"
                value={patternName}
                onChange={(e) => setPatternName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                Selected Symbol
              </label>
              <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selectedSymbol.symbol}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{selectedSymbol.name}</div>
                    <div className="text-xs text-gray-600">{selectedSymbol.desc}</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                Stitch Count
              </label>
              <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Stitches:</span>
                <span className="text-lg font-bold text-purple-600">
                  {Object.keys(gridData).filter(key => gridData[key].symbol !== '□').length}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                Pattern Stats
              </label>
              <div className="text-sm space-y-2">
                <div className="flex justify-between py-1">
                  <span className="text-gray-600">Rows:</span>
                  <span className="font-medium">{rows}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-600">Stitches per row:</span>
                  <span className="font-medium">{cols}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-600">Total cells:</span>
                  <span className="font-medium">{rows * cols}</span>
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
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                <FiFileText />
                Generate Instructions
              </button>
              <button
                onClick={savePattern}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                <FiSave />
                Save Pattern
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
