// @ts-nocheck
import { useState, useRef } from 'react';
import { FiUpload, FiX, FiFile, FiCheckCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';

interface ChartCell {
  row: number;
  col: number;
  symbol: string;
}

interface ChartData {
  title: string;
  rows: number;
  cols: number;
  isInTheRound?: boolean;
  notes?: string;
  chartData: ChartCell[];
  symbolIds?: string[];
}

interface ChartUploadProps {
  onUpload: (chartData: ChartData) => void;
  onCancel: () => void;
}

export function ChartUpload({ onUpload, onCancel }: ChartUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<ChartData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const allowedTypes = ['application/json', 'text/csv', 'text/plain'];
    if (!allowedTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(json|csv|txt)$/i)) {
      toast.error('Please upload a JSON, CSV, or TXT file');
      return;
    }

    setFile(selectedFile);
    parseFile(selectedFile);
  };

  const parseFile = async (file: File) => {
    try {
      const content = await file.text();
      let chartData: ChartData | null = null;

      if (file.name.endsWith('.json')) {
        // Parse JSON format
        const data = JSON.parse(content);
        chartData = parseJsonFormat(data);
      } else if (file.name.endsWith('.csv')) {
        // Parse CSV format
        chartData = parseCsvFormat(content);
      } else if (file.name.endsWith('.txt')) {
        // Parse text format (grid-based)
        chartData = parseTextFormat(content);
      }

      if (chartData) {
        // Validate chart data
        if (!chartData.title || !chartData.rows || !chartData.cols) {
          throw new Error('Invalid chart data: missing required fields (title, rows, cols)');
        }

        if (chartData.rows < 1 || chartData.rows > 1000 || chartData.cols < 1 || chartData.cols > 1000) {
          throw new Error('Invalid chart dimensions: rows and cols must be between 1 and 1000');
        }

        setPreview(chartData);
        toast.success('Chart data parsed successfully');
      } else {
        throw new Error('Unable to parse file');
      }
    } catch (error: any) {
      console.error('Error parsing file:', error);
      toast.error(error.message || 'Failed to parse chart file');
      setFile(null);
      setPreview(null);
    }
  };

  const parseJsonFormat = (data: any): ChartData => {
    // Expected JSON format:
    // {
    //   "title": "Chart Title",
    //   "rows": 20,
    //   "cols": 20,
    //   "isInTheRound": false,
    //   "notes": "Optional notes",
    //   "chartData": [{"row": 0, "col": 0, "symbol": "symbol-id"}, ...],
    //   "symbolIds": ["symbol-id-1", "symbol-id-2", ...]
    // }

    return {
      title: data.title || 'Imported Chart',
      rows: parseInt(data.rows) || 20,
      cols: parseInt(data.cols) || 20,
      isInTheRound: data.isInTheRound || false,
      notes: data.notes || '',
      chartData: Array.isArray(data.chartData) ? data.chartData : [],
      symbolIds: Array.isArray(data.symbolIds) ? data.symbolIds : [],
    };
  };

  const parseCsvFormat = (content: string): ChartData => {
    // Expected CSV format:
    // row,col,symbol
    // 0,0,symbol-id
    // 0,1,symbol-id
    // ...

    const lines = content.trim().split('\n');
    const chartData: ChartCell[] = [];
    let maxRow = 0;
    let maxCol = 0;
    const symbolSet = new Set<string>();

    // Skip header if present
    const startIndex = lines[0].toLowerCase().includes('row') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      if (parts.length >= 3) {
        const row = parseInt(parts[0]);
        const col = parseInt(parts[1]);
        const symbol = parts[2];

        if (!isNaN(row) && !isNaN(col) && symbol) {
          chartData.push({ row, col, symbol });
          maxRow = Math.max(maxRow, row);
          maxCol = Math.max(maxCol, col);
          symbolSet.add(symbol);
        }
      }
    }

    return {
      title: 'Imported Chart from CSV',
      rows: maxRow + 1,
      cols: maxCol + 1,
      isInTheRound: false,
      notes: '',
      chartData,
      symbolIds: Array.from(symbolSet),
    };
  };

  const parseTextFormat = (content: string): ChartData => {
    // Expected text format (grid-based):
    // Title: Chart Title
    // Rows: 20
    // Cols: 20
    // InTheRound: false
    // Grid:
    // .-.-.
    // -----
    // .-.-.
    //
    // Where each character represents a symbol

    const lines = content.trim().split('\n');
    let title = 'Imported Chart from Text';
    let rows = 0;
    let cols = 0;
    let isInTheRound = false;
    const gridLines: string[] = [];
    let inGrid = false;

    for (const line of lines) {
      if (line.toLowerCase().startsWith('title:')) {
        title = line.substring(6).trim();
      } else if (line.toLowerCase().startsWith('rows:')) {
        rows = parseInt(line.substring(5).trim()) || 0;
      } else if (line.toLowerCase().startsWith('cols:')) {
        cols = parseInt(line.substring(5).trim()) || 0;
      } else if (line.toLowerCase().startsWith('intheround:')) {
        isInTheRound = line.substring(11).trim().toLowerCase() === 'true';
      } else if (line.toLowerCase().startsWith('grid:')) {
        inGrid = true;
      } else if (inGrid && line.trim()) {
        gridLines.push(line);
      }
    }

    // If rows/cols not specified, infer from grid
    if (!rows || !cols) {
      rows = gridLines.length;
      cols = Math.max(...gridLines.map(l => l.length));
    }

    // Parse grid into cells (this is a simplified version)
    const chartData: ChartCell[] = [];
    const symbolMap: { [key: string]: string } = {};
    let symbolCounter = 0;

    for (let r = 0; r < gridLines.length; r++) {
      for (let c = 0; c < gridLines[r].length; c++) {
        const char = gridLines[r][c];
        if (char && char !== ' ') {
          // Map character to symbol ID
          if (!symbolMap[char]) {
            symbolMap[char] = `symbol-${symbolCounter++}`;
          }
          chartData.push({
            row: r,
            col: c,
            symbol: symbolMap[char],
          });
        }
      }
    }

    return {
      title,
      rows,
      cols,
      isInTheRound,
      notes: 'Imported from text file',
      chartData,
      symbolIds: Object.values(symbolMap),
    };
  };

  const handleUpload = () => {
    if (!preview) {
      toast.error('No chart data to upload');
      return;
    }

    setUploading(true);

    // Simulate upload delay
    setTimeout(() => {
      onUpload(preview);
      setUploading(false);
    }, 500);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile && fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(droppedFile);
      fileInputRef.current.files = dataTransfer.files;
      handleFileSelect({ target: fileInputRef.current } as any);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <div className="chart-upload bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Import Chart</h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          <FiX size={24} />
        </button>
      </div>

      {!preview ? (
        <div>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <FiUpload size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-lg text-gray-700 mb-2">
              Drop your chart file here or click to browse
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Supported formats: JSON, CSV, TXT
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">File Format Examples</h3>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">JSON Format:</h4>
                <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`{
  "title": "My Chart",
  "rows": 20,
  "cols": 20,
  "isInTheRound": false,
  "notes": "Optional notes",
  "chartData": [
    {"row": 0, "col": 0, "symbol": "symbol-id"},
    {"row": 0, "col": 1, "symbol": "symbol-id"}
  ],
  "symbolIds": ["symbol-id-1", "symbol-id-2"]
}`}
                </pre>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 mb-2">CSV Format:</h4>
                <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`row,col,symbol
0,0,symbol-id-1
0,1,symbol-id-2
1,0,symbol-id-1`}
                </pre>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 mb-2">Text Format:</h4>
                <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`Title: My Chart
Rows: 10
Cols: 10
InTheRound: false
Grid:
.-.-.-.-
--------
.-.-.-.-`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <FiCheckCircle className="text-green-600 mt-1" size={24} />
            <div className="flex-1">
              <h3 className="font-semibold text-green-800 mb-1">Chart Parsed Successfully</h3>
              <p className="text-sm text-green-700">
                Review the chart details below and click "Import Chart" to continue.
              </p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded">
                  {preview.title}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dimensions</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded">
                  {preview.rows} × {preview.cols}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">In the Round</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded">
                {preview.isInTheRound ? 'Yes' : 'No'}
              </div>
            </div>

            {preview.notes && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded">
                  {preview.notes}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chart Data</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded">
                {preview.chartData.length} cells, {preview.symbolIds?.length || 0} unique symbols
              </div>
            </div>
          </div>

          {file && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 flex items-center gap-3">
              <FiFile className="text-blue-600" size={20} />
              <div className="flex-1">
                <div className="text-sm font-medium text-blue-800">{file.name}</div>
                <div className="text-xs text-blue-600">
                  {(file.size / 1024).toFixed(2)} KB
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              <FiUpload />
              {uploading ? 'Importing...' : 'Import Chart'}
            </button>
            <button
              onClick={() => {
                setFile(null);
                setPreview(null);
              }}
              className="px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium"
            >
              Choose Different File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
