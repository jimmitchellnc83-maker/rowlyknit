import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FiZoomIn,
  FiZoomOut,
  FiRotateCw,
  FiInfo,
  FiDownload,
  FiPrinter,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';

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

interface ViewState {
  zoom: number;
  rotation: number;
  pan: { x: number; y: number };
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
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showLegend, setShowLegend] = useState(true);
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
  const [highlightedCell, setHighlightedCell] = useState<{ row: number; col: number } | null>(null);
  const [currentRow, setCurrentRow] = useState<number | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Touch support state
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; dist: number } | null>(null);

  // Undo/redo state
  const [history, setHistory] = useState<ViewState[]>([{ zoom: 1, rotation: 0, pan: { x: 0, y: 0 } }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const printCanvasRef = useRef<HTMLCanvasElement>(null);

  const CELL_SIZE = 40;
  const PADDING = 60;

  // Responsive canvas sizing
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({
          width: Math.max(600, rect.width),
          height: Math.max(400, rect.height - 80), // Account for header
        });
      }
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (highlightedCell) {
            const newRow = Math.min(rows, highlightedCell.row + 1);
            setHighlightedCell({ ...highlightedCell, row: newRow });
            setHighlightedRow(newRow);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (highlightedCell) {
            const newRow = Math.max(1, highlightedCell.row - 1);
            setHighlightedCell({ ...highlightedCell, row: newRow });
            setHighlightedRow(newRow);
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (highlightedCell) {
            const newCol = Math.max(0, highlightedCell.col - 1);
            setHighlightedCell({ ...highlightedCell, col: newCol });
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (highlightedCell) {
            const newCol = Math.min(cols - 1, highlightedCell.col + 1);
            setHighlightedCell({ ...highlightedCell, col: newCol });
          }
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          handleZoomOut();
          break;
        case 'Home':
          e.preventDefault();
          if (highlightedCell) {
            setHighlightedCell({ row: rows, col: 0 });
            setHighlightedRow(rows);
          }
          break;
        case 'End':
          e.preventDefault();
          if (highlightedCell) {
            setHighlightedCell({ row: 1, col: cols - 1 });
            setHighlightedRow(1);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setHighlightedCell(null);
          setHighlightedRow(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [highlightedCell, rows, cols]);

  const saveToHistory = useCallback(() => {
    const newState: ViewState = { zoom, rotation, pan };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [zoom, rotation, pan, history, historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      setZoom(state.zoom);
      setRotation(state.rotation);
      setPan(state.pan);
      setHistoryIndex(newIndex);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      setZoom(state.zoom);
      setRotation(state.rotation);
      setPan(state.pan);
      setHistoryIndex(newIndex);
    }
  };

  useEffect(() => {
    renderChart();
  }, [chartData, zoom, rotation, pan, highlightedRow, highlightedCell, currentRow, canvasSize]);

  const renderChart = (canvas?: HTMLCanvasElement, forPrint: boolean = false) => {
    const targetCanvas = canvas || canvasRef.current;
    if (!targetCanvas) return;

    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    const width = forPrint ? cols * CELL_SIZE + PADDING * 2 : targetCanvas.width;
    const height = forPrint ? rows * CELL_SIZE + PADDING * 2 : targetCanvas.height;

    if (forPrint) {
      targetCanvas.width = width;
      targetCanvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    if (!forPrint) {
      ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
      ctx.scale(zoom, zoom);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-width / 2, -height / 2);
    }

    const chartWidth = cols * CELL_SIZE;
    const chartHeight = rows * CELL_SIZE;
    const startX = (width - chartWidth) / 2;
    const startY = (height - chartHeight) / 2;

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

    // Draw row numbers
    ctx.fillStyle = '#6b7280';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let row = 0; row < rows; row++) {
      const displayRow = rows - row;
      const y = startY + row * CELL_SIZE + CELL_SIZE / 2;

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

    // Highlight current row (row tracking)
    if (currentRow !== null && !forPrint) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
      const rowIndex = rows - currentRow;
      ctx.fillRect(startX, startY + rowIndex * CELL_SIZE, chartWidth, CELL_SIZE);

      // Draw current row indicator
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.moveTo(startX - 5, startY + rowIndex * CELL_SIZE + CELL_SIZE / 2 - 6);
      ctx.lineTo(startX - 5, startY + rowIndex * CELL_SIZE + CELL_SIZE / 2 + 6);
      ctx.lineTo(startX - 15, startY + rowIndex * CELL_SIZE + CELL_SIZE / 2);
      ctx.fill();
    }

    // Highlight row if selected
    if (highlightedRow !== null && !forPrint) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      const rowIndex = rows - highlightedRow;
      ctx.fillRect(startX, startY + rowIndex * CELL_SIZE, chartWidth, CELL_SIZE);
    }

    // Highlight cell if selected
    if (highlightedCell && !forPrint) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      const rowIndex = rows - highlightedCell.row;
      ctx.strokeRect(
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
        ctx.fillStyle = symbol.color || '#000000';
        ctx.fillText(symbol.symbol, x, y);
      }
    });

    ctx.restore();
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.5, Math.min(3, zoom + delta));
    setZoom(newZoom);
  };

  // Touch event handlers
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    } else if (e.touches.length === 2) {
      const dist = getTouchDistance(e.touches);
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setTouchStart({ x: midX, y: midY, dist });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();

    if (e.touches.length === 1 && isDragging) {
      setPan({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    } else if (e.touches.length === 2 && touchStart) {
      const newDist = getTouchDistance(e.touches);
      const scale = newDist / touchStart.dist;
      const newZoom = Math.max(0.5, Math.min(3, zoom * scale));
      setZoom(newZoom);
      setTouchStart({ ...touchStart, dist: newDist });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTouchStart(null);
    saveToHistory();
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
    if (isDragging) {
      saveToHistory();
    }
    setIsDragging(false);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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
      setHighlightedCell({ row, col });
      setHighlightedRow(row);
    } else {
      setHighlightedCell(null);
      setHighlightedRow(null);
    }
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(3, zoom + 0.2);
    setZoom(newZoom);
    saveToHistory();
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.5, zoom - 0.2);
    setZoom(newZoom);
    saveToHistory();
  };

  const handleRotate = () => {
    const newRotation = (rotation + 90) % 360;
    setRotation(newRotation);
    saveToHistory();
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setHighlightedRow(null);
    setHighlightedCell(null);
    saveToHistory();
  };

  // Export to PNG
  const exportToPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `${title || 'chart'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Print support
  const handlePrint = () => {
    const printCanvas = document.createElement('canvas');
    renderChart(printCanvas, true);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${title || 'Knitting Chart'}</title>
          <style>
            body { margin: 0; padding: 20px; }
            img { max-width: 100%; height: auto; }
            h1 { font-family: Arial, sans-serif; margin-bottom: 20px; }
            @media print {
              body { padding: 0; }
              h1 { page-break-after: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>${title || 'Knitting Chart'}</h1>
          <img src="${printCanvas.toDataURL()}" />
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const moveToNextRow = () => {
    if (currentRow === null) {
      setCurrentRow(1);
    } else if (currentRow < rows) {
      setCurrentRow(currentRow + 1);
    }
  };

  const moveToPrevRow = () => {
    if (currentRow !== null && currentRow > 1) {
      setCurrentRow(currentRow - 1);
    }
  };

  return (
    <div className="chart-viewer" ref={containerRef}>
      <div className="chart-header">
        <div className="chart-title-section">
          {title && <h2 className="chart-title">{title}</h2>}
          {currentRow && (
            <div className="current-row-indicator">
              <span className="current-row-label">Current Row:</span>
              <span className="current-row-number">{currentRow}</span>
            </div>
          )}
        </div>

        <div className="chart-controls">
          <div className="control-group">
            <button
              onClick={handleZoomOut}
              className="control-btn"
              title="Zoom Out (-)"
              aria-label="Zoom out"
            >
              <FiZoomOut />
            </button>
            <span className="zoom-level">{Math.round(zoom * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="control-btn"
              title="Zoom In (+)"
              aria-label="Zoom in"
            >
              <FiZoomIn />
            </button>
          </div>

          {isInTheRound && (
            <button
              onClick={handleRotate}
              className="control-btn"
              title="Rotate Chart"
              aria-label="Rotate chart"
            >
              <FiRotateCw />
            </button>
          )}

          <div className="control-group">
            <button
              onClick={moveToPrevRow}
              className="control-btn"
              title="Previous Row"
              disabled={currentRow === null || currentRow === 1}
              aria-label="Previous row"
            >
              <FiChevronLeft />
            </button>
            <button
              onClick={moveToNextRow}
              className="control-btn"
              title="Next Row"
              disabled={currentRow === rows}
              aria-label="Next row"
            >
              <FiChevronRight />
            </button>
            {currentRow && (
              <button
                onClick={() => setCurrentRow(null)}
                className="control-btn active"
                title="Clear Current Row"
                aria-label="Clear current row"
              >
                <FiCheck />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`control-btn ${showLegend ? 'active' : ''}`}
            title="Toggle Legend"
            aria-label="Toggle legend"
          >
            <FiInfo />
          </button>

          <button
            onClick={exportToPNG}
            className="control-btn"
            title="Export to PNG"
            aria-label="Export to PNG"
          >
            <FiDownload />
          </button>

          <button
            onClick={handlePrint}
            className="control-btn"
            title="Print Chart"
            aria-label="Print chart"
          >
            <FiPrinter />
          </button>

          <div className="control-group">
            <button
              onClick={undo}
              className="control-btn-text"
              disabled={historyIndex === 0}
              title="Undo (Ctrl+Z)"
            >
              Undo
            </button>
            <button
              onClick={redo}
              className="control-btn-text"
              disabled={historyIndex === history.length - 1}
              title="Redo (Ctrl+Y)"
            >
              Redo
            </button>
          </div>

          <button onClick={resetView} className="control-btn-text">
            Reset View
          </button>
        </div>
      </div>

      <div className="chart-container">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
          tabIndex={0}
          role="img"
          aria-label="Interactive knitting chart"
        />

        {showLegend && (
          <div className="symbol-legend" role="complementary" aria-label="Symbol legend">
            <h3 className="legend-title">Symbol Legend</h3>
            <div className="legend-items">
              {symbols.map((symbol) => (
                <div key={symbol.id} className="legend-item">
                  <span
                    className="legend-symbol"
                    style={{ color: symbol.color || '#000000' }}
                    aria-hidden="true"
                  >
                    {symbol.symbol}
                  </span>
                  <div className="legend-info">
                    <div className="legend-name">{symbol.name}</div>
                    <div className="legend-description">{symbol.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {highlightedCell && (
          <div className="chart-info" role="status" aria-live="polite">
            <strong>Selected:</strong> Row {highlightedCell.row}, Stitch {highlightedCell.col + 1}
          </div>
        )}

        <div className="keyboard-hint" role="note">
          <small>
            Keyboard: Arrow keys to navigate • +/- to zoom • Esc to deselect
          </small>
        </div>
      </div>

      <style>{`
        .chart-viewer {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          min-height: 500px;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background-color: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          flex-wrap: wrap;
          gap: 12px;
        }

        .chart-title-section {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .chart-title {
          font-size: 20px;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }

        .current-row-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background-color: #22c55e;
          color: white;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
        }

        .current-row-label {
          opacity: 0.9;
        }

        .current-row-number {
          font-size: 18px;
          font-weight: 700;
        }

        .chart-controls {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .control-group {
          display: flex;
          gap: 4px;
          align-items: center;
          padding: 0 4px;
          border-left: 1px solid #d1d5db;
        }

        .control-group:first-child {
          border-left: none;
          padding-left: 0;
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
          color: #374151;
        }

        .control-btn:hover:not(:disabled) {
          background-color: #f3f4f6;
          border-color: #9ca3af;
        }

        .control-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .control-btn.active {
          background-color: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .control-btn-text {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          background-color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
          color: #374151;
        }

        .control-btn-text:hover:not(:disabled) {
          background-color: #f3f4f6;
          border-color: #9ca3af;
        }

        .control-btn-text:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .zoom-level {
          font-size: 13px;
          font-weight: 500;
          color: #4b5563;
          min-width: 45px;
          text-align: center;
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

        canvas:focus {
          outline: 2px solid #3b82f6;
          outline-offset: -2px;
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
          max-height: calc(100% - 80px);
          overflow-y: auto;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .legend-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 12px 0;
          color: #111827;
        }

        .legend-items {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .legend-item {
          display: flex;
          gap: 12px;
          align-items: flex-start;
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
        }

        .chart-info {
          position: absolute;
          bottom: 50px;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(17, 24, 39, 0.9);
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          pointer-events: none;
          white-space: nowrap;
        }

        .keyboard-hint {
          position: absolute;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(249, 250, 251, 0.95);
          color: #6b7280;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          pointer-events: none;
          border: 1px solid #e5e7eb;
        }

        @media print {
          .chart-header,
          .chart-controls,
          .symbol-legend,
          .chart-info,
          .keyboard-hint {
            display: none !important;
          }

          .chart-viewer {
            height: auto;
          }

          canvas {
            width: 100% !important;
            height: auto !important;
          }
        }

        @media (max-width: 768px) {
          .chart-header {
            flex-direction: column;
            align-items: stretch;
          }

          .chart-title-section {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .chart-controls {
            justify-content: center;
            flex-wrap: wrap;
          }

          .control-group {
            border-left: none;
            padding: 0;
          }

          .symbol-legend {
            position: static;
            max-width: 100%;
            margin: 16px;
            max-height: 300px;
          }

          .keyboard-hint {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default ChartViewer;
