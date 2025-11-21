// @ts-nocheck
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FiZoomIn, FiZoomOut, FiRotateCw, FiInfo, FiTarget } from 'react-icons/fi';
import SymbolDefinitionPopover from './SymbolDefinitionPopover';
import { KNITTING_SYMBOLS, getSymbolById, getSymbolByChar, type KnittingSymbol } from '../../data/knittingSymbols';

interface ChartSymbol {
  id: string;
  symbol: string;
  name: string;
  description: string;
  color?: string;
}

interface ChartCell {
  row: number;
  col: number;
  symbol: string;
}

interface ChartViewerProps {
  chartData: ChartCell[];
  symbols: ChartSymbol[];
  rows: number;
  cols: number;
  title?: string;
  isInTheRound?: boolean;
}

export const ChartViewer: React.FC<ChartViewerProps> = ({
  chartData,
  symbols,
  rows,
  cols,
  title,
  isInTheRound = false,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showLegend, setShowLegend] = useState(true);
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
  const [highlightedCell, setHighlightedCell] = useState<{row: number, col: number} | null>(null);

  // Symbol highlighting state
  const [highlightedSymbolId, setHighlightedSymbolId] = useState<string | null>(null);
  const [highlightedCells, setHighlightedCells] = useState<ChartCell[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<KnittingSymbol | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [highlightMode, setHighlightMode] = useState<'cell' | 'symbol'>('cell');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const CELL_SIZE = 40;
  const _PADDING = 60;

  // Find all cells with a given symbol
  const findCellsWithSymbol = useCallback((symbolId: string): ChartCell[] => {
    return chartData.filter(cell => cell.symbol === symbolId);
  }, [chartData]);

  // Get enhanced symbol definition from our knitting symbols database
  const getEnhancedSymbol = useCallback((symbolId: string): KnittingSymbol | undefined => {
    // First try to find by ID in our comprehensive database
    let knittingSymbol = getSymbolById(symbolId);
    if (knittingSymbol) return knittingSymbol;

    // Try to find by looking up the symbol character from the chart's symbol list
    const chartSymbol = symbols.find(s => s.id === symbolId);
    if (chartSymbol) {
      knittingSymbol = getSymbolByChar(chartSymbol.symbol);
      if (knittingSymbol) return knittingSymbol;

      // Create a fallback symbol from the chart's symbol data
      return {
        id: chartSymbol.id,
        symbol: chartSymbol.symbol,
        name: chartSymbol.name,
        abbreviation: chartSymbol.id.toUpperCase(),
        description: chartSymbol.description,
        instructions: 'See pattern instructions for details.',
        category: 'special' as const,
        color: chartSymbol.color,
        difficulty: 'intermediate' as const,
      };
    }

    return undefined;
  }, [symbols]);

  useEffect(() => {
    renderChart();
  }, [chartData, zoom, rotation, pan, highlightedRow, highlightedCell, highlightedCells, highlightMode]);

  const renderChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context
    ctx.save();

    // Apply transformations
    ctx.translate(canvas.width / 2 + pan.x, canvas.height / 2 + pan.y);
    ctx.scale(zoom, zoom);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // Calculate chart dimensions
    const chartWidth = cols * CELL_SIZE;
    const chartHeight = rows * CELL_SIZE;
    const startX = (canvas.width - chartWidth) / 2;
    const startY = (canvas.height - chartHeight) / 2;

    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;

    for (let row = 0; row <= rows; row++) {
      ctx.beginPath();
      ctx.moveTo(startX, startY + row * CELL_SIZE);
      ctx.lineTo(startX + chartWidth, startY + row * CELL_SIZE);
      ctx.stroke();
    }

    for (let col = 0; col <= cols; col++) {
      ctx.beginPath();
      ctx.moveTo(startX + col * CELL_SIZE, startY);
      ctx.lineTo(startX + col * CELL_SIZE, startY + chartHeight);
      ctx.stroke();
    }

    // Draw row numbers (right-to-left for knitting charts)
    ctx.fillStyle = '#6b7280';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let row = 0; row < rows; row++) {
      const displayRow = rows - row; // Start from top
      const y = startY + row * CELL_SIZE + CELL_SIZE / 2;

      // Alternate row numbering for in-the-round
      if (isInTheRound && displayRow % 2 === 0) {
        ctx.fillStyle = '#3b82f6';
      } else {
        ctx.fillStyle = '#6b7280';
      }

      ctx.fillText(displayRow.toString(), startX - 10, y);
    }

    // Draw column numbers
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#6b7280';

    for (let col = 0; col < cols; col++) {
      const x = startX + col * CELL_SIZE + CELL_SIZE / 2;
      ctx.fillText((col + 1).toString(), x, startY - 20);
    }

    // Highlight row if selected (only in cell mode)
    if (highlightMode === 'cell' && highlightedRow !== null) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      const rowIndex = rows - highlightedRow;
      ctx.fillRect(
        startX,
        startY + rowIndex * CELL_SIZE,
        chartWidth,
        CELL_SIZE
      );
    }

    // Highlight all cells with the selected symbol (symbol mode)
    if (highlightMode === 'symbol' && highlightedCells.length > 0) {
      ctx.fillStyle = 'rgba(168, 85, 247, 0.35)'; // Purple highlight
      highlightedCells.forEach(cell => {
        const rowIndex = rows - cell.row;
        ctx.fillRect(
          startX + cell.col * CELL_SIZE,
          startY + rowIndex * CELL_SIZE,
          CELL_SIZE,
          CELL_SIZE
        );
      });

      // Draw border around highlighted cells
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 2;
      highlightedCells.forEach(cell => {
        const rowIndex = rows - cell.row;
        ctx.strokeRect(
          startX + cell.col * CELL_SIZE + 1,
          startY + rowIndex * CELL_SIZE + 1,
          CELL_SIZE - 2,
          CELL_SIZE - 2
        );
      });
    }

    // Highlight single cell if selected (cell mode)
    if (highlightMode === 'cell' && highlightedCell) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
      const rowIndex = rows - highlightedCell.row;
      ctx.fillRect(
        startX + highlightedCell.col * CELL_SIZE,
        startY + rowIndex * CELL_SIZE,
        CELL_SIZE,
        CELL_SIZE
      );
    }

    // Draw symbols
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '20px Arial';

    chartData.forEach((cell) => {
      const symbol = symbols.find((s) => s.id === cell.symbol);
      const rowIndex = rows - cell.row;
      const x = startX + cell.col * CELL_SIZE + CELL_SIZE / 2;
      const y = startY + rowIndex * CELL_SIZE + CELL_SIZE / 2;

      if (symbol) {
        // Check if this symbol is highlighted
        const isHighlighted = highlightMode === 'symbol' &&
          highlightedCells.some(hc => hc.row === cell.row && hc.col === cell.col);

        if (isHighlighted) {
          // Draw with emphasis for highlighted symbols
          ctx.font = 'bold 22px Arial';
          ctx.fillStyle = symbol.color || '#000000';
          ctx.fillText(symbol.symbol, x, y);
          ctx.font = '20px Arial';
        } else {
          ctx.fillStyle = symbol.color || '#000000';
          ctx.fillText(symbol.symbol, x, y);
        }
      }
    });

    // Restore context
    ctx.restore();
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.max(0.5, Math.min(3, prev + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert screen coordinates to chart coordinates
    const chartWidth = cols * CELL_SIZE;
    const chartHeight = rows * CELL_SIZE;
    const startX = (canvas.width - chartWidth) / 2;
    const startY = (canvas.height - chartHeight) / 2;

    const adjustedX = (x - pan.x - canvas.width / 2) / zoom + canvas.width / 2;
    const adjustedY = (y - pan.y - canvas.height / 2) / zoom + canvas.height / 2;

    const col = Math.floor((adjustedX - startX) / CELL_SIZE);
    const rowIndex = Math.floor((adjustedY - startY) / CELL_SIZE);
    const row = rows - rowIndex;

    if (col >= 0 && col < cols && row > 0 && row <= rows) {
      // Find the cell and its symbol
      const clickedCell = chartData.find(c => c.row === row && c.col === col);

      if (clickedCell && highlightMode === 'symbol') {
        // Symbol highlight mode - highlight all instances of this symbol
        const symbolId = clickedCell.symbol;
        const cellsWithSymbol = findCellsWithSymbol(symbolId);
        const enhancedSymbol = getEnhancedSymbol(symbolId);

        setHighlightedSymbolId(symbolId);
        setHighlightedCells(cellsWithSymbol);
        setSelectedSymbol(enhancedSymbol || null);
        setPopoverPosition({ x: e.clientX + 10, y: e.clientY + 10 });
        setHighlightedCell(null);
        setHighlightedRow(null);
      } else {
        // Cell highlight mode - highlight single cell and row
        setHighlightedCell({ row, col });
        setHighlightedRow(row);
        setHighlightedCells([]);
        setHighlightedSymbolId(null);
        setSelectedSymbol(null);
        setPopoverPosition(null);
      }
    } else {
      // Clicked outside chart - clear all highlights
      clearHighlights();
    }
  };

  const clearHighlights = () => {
    setHighlightedCell(null);
    setHighlightedRow(null);
    setHighlightedCells([]);
    setHighlightedSymbolId(null);
    setSelectedSymbol(null);
    setPopoverPosition(null);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(3, prev + 0.2));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(0.5, prev - 0.2));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    clearHighlights();
  };

  const toggleHighlightMode = () => {
    setHighlightMode(prev => prev === 'cell' ? 'symbol' : 'cell');
    clearHighlights();
  };

  const handleClosePopover = () => {
    setSelectedSymbol(null);
    setPopoverPosition(null);
    // Keep highlights visible for reference
  };

  // Handle legend symbol click to highlight all instances
  const handleLegendSymbolClick = (symbolId: string, e: React.MouseEvent) => {
    const cellsWithSymbol = findCellsWithSymbol(symbolId);
    const enhancedSymbol = getEnhancedSymbol(symbolId);

    setHighlightMode('symbol');
    setHighlightedSymbolId(symbolId);
    setHighlightedCells(cellsWithSymbol);
    setSelectedSymbol(enhancedSymbol || null);
    setPopoverPosition({ x: e.clientX + 10, y: e.clientY + 10 });
    setHighlightedCell(null);
    setHighlightedRow(null);
  };

  return (
    <div className="chart-viewer" ref={containerRef}>
      <div className="chart-header">
        {title && <h2 className="chart-title">{title}</h2>}
        <div className="chart-controls">
          <button
            onClick={handleZoomOut}
            className="control-btn"
            title="Zoom Out"
          >
            <FiZoomOut />
          </button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="control-btn"
            title="Zoom In"
          >
            <FiZoomIn />
          </button>
          {isInTheRound && (
            <button
              onClick={handleRotate}
              className="control-btn"
              title="Rotate Chart"
            >
              <FiRotateCw />
            </button>
          )}
          <button
            onClick={toggleHighlightMode}
            className={`control-btn ${highlightMode === 'symbol' ? 'active' : ''}`}
            title={highlightMode === 'symbol' ? 'Symbol Highlight Mode (tap to highlight all instances)' : 'Cell Highlight Mode'}
          >
            <FiTarget />
          </button>
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`control-btn ${showLegend ? 'active' : ''}`}
            title="Toggle Legend"
          >
            <FiInfo />
          </button>
          <button onClick={resetView} className="control-btn-text">
            Reset View
          </button>
        </div>
      </div>

      {/* Mode indicator */}
      <div className="mode-indicator">
        {highlightMode === 'symbol' ? (
          <span className="mode-badge symbol-mode">
            <FiTarget className="inline h-3 w-3 mr-1" />
            Symbol Mode: Tap any symbol to highlight all instances
          </span>
        ) : (
          <span className="mode-badge cell-mode">
            Cell Mode: Tap to highlight individual cells
          </span>
        )}
      </div>

      <div className="chart-container">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        />

        {showLegend && (
          <div className="symbol-legend">
            <h3 className="legend-title">Symbol Legend</h3>
            <p className="legend-hint">Click any symbol to highlight all instances</p>
            <div className="legend-items">
              {symbols.map((symbol) => {
                const isHighlighted = highlightedSymbolId === symbol.id;
                const instanceCount = findCellsWithSymbol(symbol.id).length;
                return (
                  <div
                    key={symbol.id}
                    className={`legend-item ${isHighlighted ? 'highlighted' : ''}`}
                    onClick={(e) => handleLegendSymbolClick(symbol.id, e)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleLegendSymbolClick(symbol.id, e as any);
                      }
                    }}
                  >
                    <span
                      className="legend-symbol"
                      style={{ color: symbol.color || '#000000' }}
                    >
                      {symbol.symbol}
                    </span>
                    <div className="legend-info">
                      <div className="legend-name">{symbol.name}</div>
                      <div className="legend-description">{symbol.description}</div>
                      <div className="legend-count">{instanceCount} in chart</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cell info display */}
        {highlightMode === 'cell' && highlightedCell && (
          <div className="chart-info">
            <strong>Selected:</strong> Row {highlightedCell.row}, Stitch {highlightedCell.col + 1}
          </div>
        )}

        {/* Symbol highlight info display */}
        {highlightMode === 'symbol' && highlightedCells.length > 0 && !selectedSymbol && (
          <div className="chart-info symbol-info">
            <strong>{highlightedCells.length}</strong> instances highlighted
          </div>
        )}
      </div>

      {/* Symbol Definition Popover */}
      {selectedSymbol && popoverPosition && (
        <SymbolDefinitionPopover
          symbol={selectedSymbol}
          position={popoverPosition}
          instanceCount={highlightedCells.length}
          onClose={handleClosePopover}
        />
      )}

      <style>{`
        .chart-viewer {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background-color: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .chart-title {
          font-size: 20px;
          font-weight: 600;
          color: #111827;
        }

        .chart-controls {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .control-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #d1d5db;
          background-color: white;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .control-btn:hover {
          background-color: #f3f4f6;
          border-color: #9ca3af;
        }

        .control-btn.active {
          background-color: #8B5CF6;
          color: white;
          border-color: #8B5CF6;
        }

        .control-btn-text {
          padding: 8px 16px;
          border: 1px solid #d1d5db;
          background-color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .control-btn-text:hover {
          background-color: #f3f4f6;
          border-color: #9ca3af;
        }

        .zoom-level {
          font-size: 14px;
          font-weight: 500;
          color: #4b5563;
          min-width: 50px;
          text-align: center;
        }

        .mode-indicator {
          padding: 8px 16px;
          background-color: #faf5ff;
          border-bottom: 1px solid #e9d5ff;
        }

        .mode-badge {
          font-size: 12px;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
        }

        .mode-badge.symbol-mode {
          color: #7c3aed;
        }

        .mode-badge.cell-mode {
          color: #6b7280;
        }

        .chart-container {
          position: relative;
          flex: 1;
          background-color: #ffffff;
          overflow: hidden;
        }

        canvas {
          display: block;
          width: 100%;
          height: 100%;
        }

        .symbol-legend {
          position: absolute;
          top: 16px;
          right: 16px;
          background-color: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          max-width: 300px;
          max-height: calc(100% - 32px);
          overflow-y: auto;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .legend-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 4px;
          color: #111827;
        }

        .legend-hint {
          font-size: 11px;
          color: #8B5CF6;
          margin-bottom: 12px;
        }

        .legend-items {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .legend-item {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          padding: 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          border: 2px solid transparent;
        }

        .legend-item:hover {
          background-color: #faf5ff;
          border-color: #e9d5ff;
        }

        .legend-item.highlighted {
          background-color: #f3e8ff;
          border-color: #8B5CF6;
        }

        .legend-symbol {
          font-size: 24px;
          font-weight: bold;
          min-width: 32px;
          text-align: center;
        }

        .legend-info {
          flex: 1;
        }

        .legend-name {
          font-weight: 500;
          font-size: 14px;
          color: #111827;
          margin-bottom: 2px;
        }

        .legend-description {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 4px;
        }

        .legend-count {
          font-size: 11px;
          color: #8B5CF6;
          font-weight: 500;
        }

        .chart-info {
          position: absolute;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(17, 24, 39, 0.9);
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          pointer-events: none;
        }

        .chart-info.symbol-info {
          background-color: rgba(139, 92, 246, 0.9);
        }

        @media (max-width: 768px) {
          .chart-header {
            flex-direction: column;
            gap: 12px;
            align-items: stretch;
          }

          .chart-controls {
            justify-content: center;
            flex-wrap: wrap;
          }

          .symbol-legend {
            position: static;
            max-width: 100%;
            margin: 16px;
            max-height: 300px;
          }
        }
      `}</style>
    </div>
  );
};

export default ChartViewer;
