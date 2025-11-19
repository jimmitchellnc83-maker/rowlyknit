// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { FiZoomIn, FiZoomOut, FiRotateCw, FiInfo } from 'react-icons/fi';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const CELL_SIZE = 40;
  const _PADDING = 60;

  useEffect(() => {
    renderChart();
  }, [chartData, zoom, rotation, pan, highlightedRow, highlightedCell]);

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

    // Highlight row if selected
    if (highlightedRow !== null) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      const rowIndex = rows - highlightedRow;
      ctx.fillRect(
        startX,
        startY + rowIndex * CELL_SIZE,
        chartWidth,
        CELL_SIZE
      );
    }

    // Highlight cell if selected
    if (highlightedCell) {
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
        ctx.fillStyle = symbol.color || '#000000';
        ctx.fillText(symbol.symbol, x, y);
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
      setHighlightedCell({ row, col });
      setHighlightedRow(row);
    } else {
      setHighlightedCell(null);
      setHighlightedRow(null);
    }
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
    setHighlightedRow(null);
    setHighlightedCell(null);
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
            <div className="legend-items">
              {symbols.map((symbol) => (
                <div key={symbol.id} className="legend-item">
                  <span
                    className="legend-symbol"
                    style={{ color: symbol.color || '#000000' }}
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
          <div className="chart-info">
            <strong>Selected:</strong> Row {highlightedCell.row}, Stitch {highlightedCell.col + 1}
          </div>
        )}
      </div>

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
          background-color: #3b82f6;
          color: white;
          border-color: #3b82f6;
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
          margin-bottom: 12px;
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
