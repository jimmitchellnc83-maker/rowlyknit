import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FiCheck, FiLoader, FiEye, FiEyeOff, FiRefreshCw } from 'react-icons/fi';

interface ChartCell {
  row: number;
  col: number;
  symbol: string;
}

interface ChartSymbol {
  id: string;
  symbol: string;
  name: string;
  description: string;
  color?: string;
}

interface CompletedCell {
  row: number;
  col: number;
}

interface ChartProgress {
  current_row: number;
  current_column: number;
  completed_cells: CompletedCell[];
  completed_rows: number[];
  tracking_enabled: boolean;
}

interface InteractiveChartProgressProps {
  projectId: string;
  chartId: string;
  chartData: ChartCell[];
  symbols: ChartSymbol[];
  rows: number;
  cols: number;
  title?: string;
  isInTheRound?: boolean;
  readOnly?: boolean;
}

export const InteractiveChartProgress: React.FC<InteractiveChartProgressProps> = ({
  projectId,
  chartId,
  chartData,
  symbols,
  rows,
  cols,
  title,
  isInTheRound: _isInTheRound = false,
  readOnly = false,
}) => {
  const [progress, setProgress] = useState<ChartProgress>({
    current_row: 0,
    current_column: 0,
    completed_cells: [],
    completed_rows: [],
    tracking_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLegend, setShowLegend] = useState(true);

  const CELL_SIZE = 32;

  // Load progress on mount
  useEffect(() => {
    if (!readOnly && projectId && chartId) {
      loadProgress();
    } else {
      setLoading(false);
    }
  }, [projectId, chartId, readOnly]);

  const loadProgress = async () => {
    try {
      const response = await axios.get(`/api/projects/${projectId}/charts/${chartId}/progress`);
      if (response.data.success) {
        setProgress(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load chart progress:', err);
    } finally {
      setLoading(false);
    }
  };

  const isCellCompleted = useCallback((row: number, col: number): boolean => {
    return progress.completed_cells.some(c => c.row === row && c.col === col);
  }, [progress.completed_cells]);

  const isRowCompleted = useCallback((row: number): boolean => {
    return progress.completed_rows.includes(row);
  }, [progress.completed_rows]);

  const toggleCell = async (row: number, col: number) => {
    if (readOnly || !progress.tracking_enabled) return;

    const isCompleted = isCellCompleted(row, col);
    setSaving(true);

    try {
      const response = await axios.post(
        `/api/projects/${projectId}/charts/${chartId}/mark-cell`,
        { row, column: col, completed: !isCompleted }
      );

      if (response.data.success) {
        setProgress(prev => ({
          ...prev,
          current_row: row,
          current_column: col,
          completed_cells: response.data.data.completed_cells,
          completed_rows: response.data.data.completed_rows,
        }));
      }
    } catch (err) {
      console.error('Failed to toggle cell:', err);
    } finally {
      setSaving(false);
    }
  };

  const markRowComplete = async (row: number) => {
    if (readOnly || !progress.tracking_enabled) return;

    const isCompleted = isRowCompleted(row);
    setSaving(true);

    try {
      const response = await axios.post(
        `/api/projects/${projectId}/charts/${chartId}/mark-row`,
        { row, completed: !isCompleted, totalColumns: cols }
      );

      if (response.data.success) {
        setProgress(prev => ({
          ...prev,
          current_row: response.data.data.current_row,
          completed_cells: response.data.data.completed_cells,
          completed_rows: response.data.data.completed_rows,
        }));
      }
    } catch (err) {
      console.error('Failed to mark row:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleTracking = async () => {
    if (readOnly) return;

    setSaving(true);
    try {
      const response = await axios.post(
        `/api/projects/${projectId}/charts/${chartId}/progress`,
        { tracking_enabled: !progress.tracking_enabled }
      );

      if (response.data.success) {
        setProgress(prev => ({
          ...prev,
          tracking_enabled: response.data.data.tracking_enabled,
        }));
      }
    } catch (err) {
      console.error('Failed to toggle tracking:', err);
    } finally {
      setSaving(false);
    }
  };

  const clearProgress = async () => {
    if (readOnly || !confirm('Are you sure you want to clear all progress?')) return;

    setSaving(true);
    try {
      const response = await axios.delete(
        `/api/projects/${projectId}/charts/${chartId}/progress`
      );

      if (response.data.success) {
        setProgress({
          current_row: 0,
          current_column: 0,
          completed_cells: [],
          completed_rows: [],
          tracking_enabled: true,
        });
      }
    } catch (err) {
      console.error('Failed to clear progress:', err);
    } finally {
      setSaving(false);
    }
  };

  // Build grid for display (charts typically read bottom to top)
  const grid: (ChartCell | null)[][] = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const cell = chartData.find(cell => cell.row === r && cell.col === c);
      grid[r][c] = cell || null;
    }
  }

  // Get symbol display
  const getSymbolDisplay = (symbolId: string): { char: string; color: string } => {
    const sym = symbols.find(s => s.id === symbolId);
    return {
      char: sym?.symbol || '?',
      color: sym?.color || '#333',
    };
  };

  // Calculate completion percentage
  const totalCells = rows * cols;
  const completedCount = progress.completed_cells.length;
  const completionPercent = totalCells > 0 ? Math.round((completedCount / totalCells) * 100) : 0;

  if (loading) {
    return (
      <div className="chart-loading">
        <FiLoader className="spin" />
        <span>Loading chart...</span>
      </div>
    );
  }

  return (
    <div className="interactive-chart">
      {/* Header Controls */}
      <div className="chart-header">
        {title && <h3 className="chart-title">{title}</h3>}

        <div className="chart-controls">
          {!readOnly && (
            <>
              <button
                className={`control-btn ${progress.tracking_enabled ? 'active' : ''}`}
                onClick={toggleTracking}
                title={progress.tracking_enabled ? 'Disable tracking' : 'Enable tracking'}
              >
                {progress.tracking_enabled ? <FiEye /> : <FiEyeOff />}
                <span>Track</span>
              </button>
              <button
                className="control-btn"
                onClick={clearProgress}
                title="Clear all progress"
              >
                <FiRefreshCw />
                <span>Reset</span>
              </button>
            </>
          )}
          <button
            className={`control-btn ${showLegend ? 'active' : ''}`}
            onClick={() => setShowLegend(!showLegend)}
          >
            <span>Legend</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {!readOnly && progress.tracking_enabled && (
        <div className="progress-bar-container">
          <div className="progress-info">
            <span>{completedCount} / {totalCells} cells</span>
            <span>{completionPercent}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="chart-legend">
          <div className="legend-colors">
            <div className="legend-item">
              <span className="legend-swatch completed" />
              <span>Completed</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch current-row" />
              <span>Current Row</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch current-cell" />
              <span>Current Cell</span>
            </div>
          </div>
          <div className="legend-symbols">
            {symbols.slice(0, 8).map(sym => (
              <div key={sym.id} className="symbol-item">
                <span className="symbol-char" style={{ color: sym.color }}>{sym.symbol}</span>
                <span className="symbol-name">{sym.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart Grid */}
      <div className="chart-grid-container">
        <div className="chart-grid" style={{
          gridTemplateColumns: `40px repeat(${cols}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${rows}, ${CELL_SIZE}px) 30px`,
        }}>
          {/* Render rows from top to bottom (in knitting charts, bottom row is row 1) */}
          {[...Array(rows)].map((_, rowIdx) => {
            const displayRow = rows - 1 - rowIdx; // Actual row number (0-indexed from bottom)
            const rowNum = displayRow + 1; // Display row number (1-indexed)
            const isCurrentRow = displayRow === progress.current_row;
            const rowCompleted = isRowCompleted(displayRow);

            return (
              <React.Fragment key={`row-${displayRow}`}>
                {/* Row number */}
                <div
                  className={`row-number ${isCurrentRow ? 'current' : ''} ${rowCompleted ? 'completed' : ''}`}
                  onClick={() => markRowComplete(displayRow)}
                  title={`Click to ${rowCompleted ? 'unmark' : 'mark'} row ${rowNum} as complete`}
                >
                  {rowNum}
                  {rowCompleted && <FiCheck className="row-check" />}
                </div>

                {/* Cells */}
                {[...Array(cols)].map((_, colIdx) => {
                  const cell = grid[displayRow]?.[colIdx];
                  const isCompleted = isCellCompleted(displayRow, colIdx);
                  const isCurrent = displayRow === progress.current_row && colIdx === progress.current_column;
                  const { char, color } = cell ? getSymbolDisplay(cell.symbol) : { char: '', color: '#ccc' };

                  return (
                    <div
                      key={`cell-${displayRow}-${colIdx}`}
                      className={`
                        chart-cell
                        ${isCompleted ? 'completed' : ''}
                        ${isCurrent ? 'current' : ''}
                        ${isCurrentRow ? 'current-row' : ''}
                      `}
                      onClick={() => toggleCell(displayRow, colIdx)}
                      style={{ color }}
                    >
                      <span className="cell-symbol">{char}</span>
                      {isCompleted && progress.tracking_enabled && (
                        <div className="completion-overlay" />
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}

          {/* Column numbers at bottom */}
          <div className="col-spacer" />
          {[...Array(cols)].map((_, colIdx) => (
            <div key={`col-${colIdx}`} className="col-number">
              {colIdx + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Saving indicator */}
      {saving && (
        <div className="saving-indicator">
          <FiLoader className="spin" />
          <span>Saving...</span>
        </div>
      )}

      <style>{`
        .interactive-chart {
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

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .chart-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }

        .chart-controls {
          display: flex;
          gap: 8px;
        }

        .control-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .control-btn:hover {
          background: #f3f4f6;
        }

        .control-btn.active {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .progress-bar-container {
          margin-bottom: 16px;
        }

        .progress-info {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 4px;
        }

        .progress-bar {
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #22c55e, #16a34a);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .chart-legend {
          margin-bottom: 16px;
          padding: 12px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .legend-colors {
          display: flex;
          gap: 16px;
          margin-bottom: 12px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
        }

        .legend-swatch {
          width: 18px;
          height: 18px;
          border-radius: 4px;
          border: 1px solid #d1d5db;
        }

        .legend-swatch.completed {
          background: rgba(34, 197, 94, 0.3);
        }

        .legend-swatch.current-row {
          background: rgba(245, 158, 11, 0.3);
        }

        .legend-swatch.current-cell {
          border: 2px solid #3b82f6;
          background: transparent;
        }

        .legend-symbols {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .symbol-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          padding: 2px 6px;
          background: white;
          border-radius: 4px;
        }

        .symbol-char {
          font-weight: 600;
          font-size: 14px;
        }

        .symbol-name {
          color: #6b7280;
        }

        .chart-grid-container {
          overflow-x: auto;
          padding-bottom: 8px;
        }

        .chart-grid {
          display: grid;
          gap: 1px;
          background: #e5e7eb;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          width: fit-content;
        }

        .row-number {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          font-size: 11px;
          font-weight: 500;
          color: #6b7280;
          background: #f3f4f6;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .row-number:hover {
          background: #e5e7eb;
        }

        .row-number.current {
          background: rgba(245, 158, 11, 0.3);
          font-weight: 700;
          color: #92400e;
        }

        .row-number.completed {
          background: rgba(34, 197, 94, 0.2);
          color: #166534;
        }

        .row-check {
          font-size: 10px;
        }

        .col-spacer {
          background: #f3f4f6;
        }

        .col-number {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: #9ca3af;
          background: #f3f4f6;
        }

        .chart-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          cursor: pointer;
          position: relative;
          transition: all 0.15s;
          font-size: 16px;
          font-weight: 500;
        }

        .chart-cell:hover {
          background: #f0f9ff;
          transform: scale(1.05);
          z-index: 1;
        }

        .chart-cell.current-row {
          background: rgba(245, 158, 11, 0.1);
        }

        .chart-cell.current {
          box-shadow: inset 0 0 0 2px #3b82f6;
        }

        .chart-cell.completed {
          background: rgba(34, 197, 94, 0.15);
        }

        .chart-cell.completed:hover {
          background: rgba(34, 197, 94, 0.25);
        }

        .completion-overlay {
          position: absolute;
          inset: 0;
          background: rgba(34, 197, 94, 0.2);
          pointer-events: none;
        }

        .cell-symbol {
          position: relative;
          z-index: 1;
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
          .chart-controls {
            flex-wrap: wrap;
          }

          .control-btn span {
            display: none;
          }

          .legend-colors {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
};

export default InteractiveChartProgress;
