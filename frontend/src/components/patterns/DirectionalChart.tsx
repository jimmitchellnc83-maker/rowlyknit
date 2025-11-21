import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { FiArrowRight, FiArrowLeft, FiRotateCcw, FiCheck, FiLoader, FiChevronDown } from 'react-icons/fi';

type WorkingDirection = 'flat_knitting' | 'in_the_round' | 'flat_from_center';
type CurrentDirection = 'left_to_right' | 'right_to_left' | 'center_out';

interface ChartCell {
  row: number;
  col: number;
  symbol: string;
}

interface ChartSymbol {
  id: string;
  symbol: string;
  name: string;
  color?: string;
}

interface SwipeState {
  startX: number;
  startY: number;
  isDragging: boolean;
}

interface DirectionalChartProps {
  projectId: string;
  chartId: string;
  chartData: ChartCell[];
  symbols: ChartSymbol[];
  rows: number;
  cols: number;
  title?: string;
}

export const DirectionalChart: React.FC<DirectionalChartProps> = ({
  projectId,
  chartId,
  chartData,
  symbols,
  rows,
  cols,
  title,
}) => {
  const [workingDirection, setWorkingDirection] = useState<WorkingDirection>('flat_knitting');
  const [currentDirection, setCurrentDirection] = useState<CurrentDirection>('left_to_right');
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const [completedCells, setCompletedCells] = useState<Array<{ row: number; col: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [swipeState, setSwipeState] = useState<SwipeState>({ startX: 0, startY: 0, isDragging: false });

  const chartRef = useRef<HTMLDivElement>(null);
  const CELL_SIZE = 36;
  const MIN_SWIPE_DISTANCE = 50;

  // Load progress on mount
  useEffect(() => {
    loadProgress();
  }, [projectId, chartId]);

  const loadProgress = async () => {
    try {
      const response = await axios.get(`/api/projects/${projectId}/charts/${chartId}/progress`);
      if (response.data.success) {
        const data = response.data.data;
        setCurrentRow(data.current_row || 0);
        setCurrentCol(data.current_column || 0);
        setWorkingDirection(data.working_direction || 'flat_knitting');
        setCurrentDirection(data.current_direction || 'left_to_right');
        setCompletedCells(data.completed_cells || []);
      }
    } catch (err) {
      console.error('Failed to load progress:', err);
    } finally {
      setLoading(false);
    }
  };

  const setDirection = async (direction: WorkingDirection) => {
    setSaving(true);
    try {
      const response = await axios.post(`/api/projects/${projectId}/charts/${chartId}/set-direction`, {
        working_direction: direction,
      });
      if (response.data.success) {
        setWorkingDirection(direction);
        setCurrentDirection(response.data.data.current_direction);
      }
    } catch (err) {
      console.error('Failed to set direction:', err);
    } finally {
      setSaving(false);
    }
  };

  const advanceStitch = useCallback(async (direction: 'forward' | 'backward') => {
    setSaving(true);
    try {
      const response = await axios.post(`/api/projects/${projectId}/charts/${chartId}/advance-stitch`, {
        direction,
        chart_width: cols,
        chart_height: rows,
      });
      if (response.data.success) {
        const data = response.data.data;
        setCurrentRow(data.current_row);
        setCurrentCol(data.current_column);
        setCurrentDirection(data.current_direction);
        // Reload to get updated completed cells
        loadProgress();
      }
    } catch (err) {
      console.error('Failed to advance stitch:', err);
    } finally {
      setSaving(false);
    }
  }, [projectId, chartId, cols, rows]);

  const toggleDirection = async () => {
    setSaving(true);
    try {
      const response = await axios.post(`/api/projects/${projectId}/charts/${chartId}/toggle-direction`);
      if (response.data.success) {
        setCurrentDirection(response.data.data.current_direction);
      }
    } catch (err) {
      console.error('Failed to toggle direction:', err);
    } finally {
      setSaving(false);
    }
  };

  const markRowComplete = async () => {
    setSaving(true);
    try {
      const response = await axios.post(`/api/projects/${projectId}/charts/${chartId}/mark-row`, {
        row: currentRow,
        completed: true,
        totalColumns: cols,
      });
      if (response.data.success) {
        setCompletedCells(response.data.data.completed_cells);
        setCurrentRow(response.data.data.current_row);
        // Update direction for new row
        const newDirection = workingDirection === 'flat_knitting'
          ? (response.data.data.current_row % 2 === 0 ? 'left_to_right' : 'right_to_left')
          : 'left_to_right';
        setCurrentDirection(newDirection as CurrentDirection);
        setCurrentCol(newDirection === 'left_to_right' ? 0 : cols - 1);
      }
    } catch (err) {
      console.error('Failed to mark row complete:', err);
    } finally {
      setSaving(false);
    }
  };

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setSwipeState({ startX: touch.clientX, startY: touch.clientY, isDragging: true });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!swipeState.isDragging) return;
    const touch = e.changedTouches[0];
    handleSwipeEnd(touch.clientX, touch.clientY);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setSwipeState({ startX: e.clientX, startY: e.clientY, isDragging: true });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!swipeState.isDragging) return;
    handleSwipeEnd(e.clientX, e.clientY);
  };

  const handleSwipeEnd = (endX: number, endY: number) => {
    const deltaX = endX - swipeState.startX;
    const deltaY = endY - swipeState.startY;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      if (Math.abs(deltaX) > MIN_SWIPE_DISTANCE) {
        if (deltaX > 0) {
          advanceStitch('forward');
        } else {
          advanceStitch('backward');
        }
      }
    } else {
      // Vertical swipe
      if (Math.abs(deltaY) > MIN_SWIPE_DISTANCE && deltaY > 0) {
        markRowComplete();
      }
    }

    setSwipeState({ ...swipeState, isDragging: false });
  };

  // Build grid
  const grid: (ChartCell | null)[][] = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const cell = chartData.find(cell => cell.row === r && cell.col === c);
      grid[r][c] = cell || null;
    }
  }

  const getSymbolDisplay = (symbolId: string) => {
    const sym = symbols.find(s => s.id === symbolId);
    return { char: sym?.symbol || '?', color: sym?.color || '#333' };
  };

  const isCellCompleted = (row: number, col: number) => {
    return completedCells.some(c => c.row === row && c.col === col);
  };

  const getDirectionIcon = () => {
    if (currentDirection === 'left_to_right') return <FiArrowRight />;
    if (currentDirection === 'right_to_left') return <FiArrowLeft />;
    return <FiArrowRight />;
  };

  const getDirectionLabel = () => {
    const labels: Record<WorkingDirection, string> = {
      flat_knitting: 'Flat Knitting (alternating)',
      in_the_round: 'In the Round (always right)',
      flat_from_center: 'From Center Out',
    };
    return labels[workingDirection];
  };

  if (loading) {
    return (
      <div className="chart-loading">
        <FiLoader className="spin" />
        <span>Loading chart...</span>
      </div>
    );
  }

  return (
    <div className="directional-chart">
      {/* Header */}
      {title && <h3 className="chart-title">{title}</h3>}

      {/* Direction Controls */}
      <div className="direction-controls">
        <div className="direction-selector">
          <label>Working Direction:</label>
          <select
            value={workingDirection}
            onChange={(e) => setDirection(e.target.value as WorkingDirection)}
            disabled={saving}
          >
            <option value="flat_knitting">Flat Knitting (alternating)</option>
            <option value="in_the_round">In the Round</option>
            <option value="flat_from_center">From Center Out</option>
          </select>
        </div>

        <div className="current-direction">
          <span className="direction-label">Current:</span>
          <button
            className="direction-toggle"
            onClick={toggleDirection}
            title="Click to toggle direction"
          >
            {getDirectionIcon()}
          </button>
        </div>

        <div className="position-info">
          <span>Row {currentRow + 1}, Stitch {currentCol + 1}</span>
        </div>
      </div>

      {/* Chart Grid with Swipe Support */}
      <div
        ref={chartRef}
        className="chart-container"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <div className="chart-grid" style={{
          gridTemplateColumns: `40px repeat(${cols}, ${CELL_SIZE}px)`,
        }}>
          {/* Render rows (bottom to top in knitting) */}
          {[...Array(rows)].map((_, rowIdx) => {
            const displayRow = rows - 1 - rowIdx;
            const rowNum = displayRow + 1;
            const isCurrentRow = displayRow === currentRow;
            const rowDirection = workingDirection === 'flat_knitting'
              ? (displayRow % 2 === 0 ? 'left_to_right' : 'right_to_left')
              : 'left_to_right';

            return (
              <React.Fragment key={`row-${displayRow}`}>
                {/* Row number with direction indicator */}
                <div className={`row-header ${isCurrentRow ? 'current' : ''}`}>
                  <span className="row-num">{rowNum}</span>
                  {isCurrentRow && (
                    <span className="row-direction">
                      {rowDirection === 'left_to_right' ? '→' : '←'}
                    </span>
                  )}
                </div>

                {/* Cells */}
                {[...Array(cols)].map((_, colIdx) => {
                  const cell = grid[displayRow]?.[colIdx];
                  const isCompleted = isCellCompleted(displayRow, colIdx);
                  const isCurrent = displayRow === currentRow && colIdx === currentCol;
                  const isNext = isCurrentRow && (
                    (currentDirection === 'left_to_right' && colIdx === currentCol + 1) ||
                    (currentDirection === 'right_to_left' && colIdx === currentCol - 1)
                  );
                  const { char, color } = cell ? getSymbolDisplay(cell.symbol) : { char: '', color: '#ccc' };

                  return (
                    <div
                      key={`cell-${displayRow}-${colIdx}`}
                      className={`
                        chart-cell
                        ${isCompleted ? 'completed' : ''}
                        ${isCurrent ? 'current' : ''}
                        ${isCurrentRow ? 'current-row' : ''}
                        ${isNext ? 'next' : ''}
                      `}
                      style={{ color }}
                    >
                      <span className="symbol">{char}</span>
                      {isCurrent && (
                        <div className="current-indicator">
                          {getDirectionIcon()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Swipe Instructions */}
      <div className="swipe-instructions">
        <div className="instruction">
          <span className="gesture">Swipe →</span>
          <span className="action">Next stitch</span>
        </div>
        <div className="instruction">
          <span className="gesture">Swipe ←</span>
          <span className="action">Previous stitch</span>
        </div>
        <div className="instruction">
          <span className="gesture">Swipe ↓</span>
          <span className="action">Complete row</span>
        </div>
      </div>

      {/* Keyboard Controls */}
      <div className="keyboard-controls">
        <button onClick={() => advanceStitch('backward')} disabled={saving}>
          <FiArrowLeft /> Back
        </button>
        <button onClick={() => advanceStitch('forward')} disabled={saving}>
          Forward <FiArrowRight />
        </button>
        <button onClick={markRowComplete} disabled={saving}>
          <FiChevronDown /> Complete Row
        </button>
      </div>

      {saving && (
        <div className="saving-indicator">
          <FiLoader className="spin" /> Saving...
        </div>
      )}

      <style>{`
        .directional-chart {
          position: relative;
          background: white;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .chart-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 40px;
          color: #6b7280;
        }

        .chart-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px 0;
        }

        .direction-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: center;
          padding: 12px;
          background: #f3f4f6;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .direction-selector {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .direction-selector label {
          font-size: 13px;
          font-weight: 500;
        }

        .direction-selector select {
          padding: 6px 10px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 13px;
        }

        .current-direction {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .direction-label {
          font-size: 13px;
          color: #6b7280;
        }

        .direction-toggle {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 50%;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .direction-toggle:hover {
          background: #2563eb;
          transform: scale(1.1);
        }

        .position-info {
          margin-left: auto;
          padding: 6px 12px;
          background: white;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
        }

        .chart-container {
          overflow-x: auto;
          cursor: grab;
          user-select: none;
          padding-bottom: 8px;
        }

        .chart-container:active {
          cursor: grabbing;
        }

        .chart-grid {
          display: grid;
          gap: 1px;
          background: #e5e7eb;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          width: fit-content;
        }

        .row-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
          font-size: 11px;
          font-weight: 500;
          padding: 4px;
        }

        .row-header.current {
          background: rgba(245, 158, 11, 0.3);
        }

        .row-num {
          color: #6b7280;
        }

        .row-direction {
          font-size: 14px;
          color: #3b82f6;
          font-weight: 700;
        }

        .chart-cell {
          width: ${CELL_SIZE}px;
          height: ${CELL_SIZE}px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          position: relative;
          transition: all 0.15s;
          font-size: 16px;
        }

        .chart-cell.current-row {
          background: rgba(245, 158, 11, 0.1);
        }

        .chart-cell.completed {
          background: rgba(34, 197, 94, 0.2);
        }

        .chart-cell.current {
          background: rgba(59, 130, 246, 0.2);
          box-shadow: inset 0 0 0 3px #3b82f6;
          z-index: 2;
        }

        .chart-cell.next {
          background: rgba(59, 130, 246, 0.1);
          border: 1px dashed #3b82f6;
        }

        .current-indicator {
          position: absolute;
          top: -10px;
          right: -10px;
          width: 24px;
          height: 24px;
          background: #3b82f6;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }

        .swipe-instructions {
          display: flex;
          justify-content: center;
          gap: 24px;
          padding: 12px;
          background: #f9fafb;
          border-radius: 8px;
          margin: 16px 0;
        }

        .instruction {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .gesture {
          font-weight: 600;
          font-size: 13px;
          color: #374151;
        }

        .action {
          font-size: 11px;
          color: #6b7280;
        }

        .keyboard-controls {
          display: flex;
          justify-content: center;
          gap: 8px;
        }

        .keyboard-controls button {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 16px;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .keyboard-controls button:hover:not(:disabled) {
          background: #f3f4f6;
        }

        .keyboard-controls button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .saving-indicator {
          position: absolute;
          top: 16px;
          right: 16px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: white;
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          font-size: 12px;
          color: #6b7280;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .direction-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .position-info {
            margin-left: 0;
            text-align: center;
          }

          .swipe-instructions {
            flex-wrap: wrap;
          }

          .keyboard-controls {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
};

export default DirectionalChart;
