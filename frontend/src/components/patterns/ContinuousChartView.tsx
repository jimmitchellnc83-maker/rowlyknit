import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Card, Typography, Box, IconButton, Slider, Tooltip, Chip, Alert } from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  FitScreen,
  KeyboardArrowUp,
  KeyboardArrowDown,
  FirstPage,
  LastPage,
} from '@mui/icons-material';

interface ChartCell {
  symbol: string;
  color?: string;
  stitch_type?: string;
}

interface ChartPage {
  page_number: number;
  rows: ChartCell[][];
  start_row: number;
  end_row: number;
}

interface ChartProgress {
  completed_cells: Array<{ row: number; col: number }>;
  completed_rows: number[];
  current_row: number;
  current_column: number;
}

interface ContinuousChartViewProps {
  pages: ChartPage[];
  chartWidth: number;
  progress?: ChartProgress;
  onCellClick?: (globalRow: number, col: number) => void;
  onRowClick?: (globalRow: number) => void;
  cellSize?: number;
  showRowNumbers?: boolean;
  showPageBreaks?: boolean;
  highlightCurrentRow?: boolean;
}

const MIN_CELL_SIZE = 16;
const MAX_CELL_SIZE = 64;
const DEFAULT_CELL_SIZE = 32;

// Color mapping for common stitch types
const stitchColors: Record<string, string> = {
  knit: '#FFFFFF',
  purl: '#E0E0E0',
  yarn_over: '#FFE4B5',
  k2tog: '#FFB6C1',
  ssk: '#ADD8E6',
  cable_left: '#DDA0DD',
  cable_right: '#98FB98',
  slip: '#F0F0F0',
};

const ContinuousChartView: React.FC<ContinuousChartViewProps> = ({
  pages,
  chartWidth,
  progress,
  onCellClick,
  onRowClick,
  cellSize: initialCellSize = DEFAULT_CELL_SIZE,
  showRowNumbers = true,
  showPageBreaks = true,
  highlightCurrentRow = true,
}) => {
  const [cellSize, setCellSize] = useState(initialCellSize);
  const [scrollToRow, setScrollToRow] = useState<number | null>(null);
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Flatten all pages into a single array of rows with global row indices
  const flattenedRows = useMemo(() => {
    const rows: Array<{
      cells: ChartCell[];
      globalRow: number;
      pageNumber: number;
      isPageStart: boolean;
      isPageEnd: boolean;
    }> = [];

    pages.forEach((page) => {
      page.rows.forEach((row, rowIndex) => {
        const globalRow = page.start_row + rowIndex;
        rows.push({
          cells: row,
          globalRow,
          pageNumber: page.page_number,
          isPageStart: rowIndex === 0,
          isPageEnd: rowIndex === page.rows.length - 1,
        });
      });
    });

    return rows;
  }, [pages]);

  // Get total row count
  const totalRows = flattenedRows.length;

  // Create completed cells lookup for performance
  const completedCellsSet = useMemo(() => {
    if (!progress?.completed_cells) return new Set<string>();
    return new Set(
      progress.completed_cells.map((c) => `${c.row}-${c.col}`)
    );
  }, [progress?.completed_cells]);

  const completedRowsSet = useMemo(() => {
    if (!progress?.completed_rows) return new Set<number>();
    return new Set(progress.completed_rows);
  }, [progress?.completed_rows]);

  // Scroll to current row when progress changes
  useEffect(() => {
    if (progress?.current_row !== undefined && listRef.current) {
      // Find the index in flattened rows
      const rowIndex = flattenedRows.findIndex(
        (r) => r.globalRow === progress.current_row
      );
      if (rowIndex !== -1) {
        listRef.current.scrollToItem(rowIndex, 'center');
      }
    }
  }, [progress?.current_row, flattenedRows]);

  // Handle scroll to specific row
  useEffect(() => {
    if (scrollToRow !== null && listRef.current) {
      const rowIndex = flattenedRows.findIndex((r) => r.globalRow === scrollToRow);
      if (rowIndex !== -1) {
        listRef.current.scrollToItem(rowIndex, 'center');
      }
      setScrollToRow(null);
    }
  }, [scrollToRow, flattenedRows]);

  const handleZoomIn = () => {
    setCellSize((prev) => Math.min(prev + 4, MAX_CELL_SIZE));
  };

  const handleZoomOut = () => {
    setCellSize((prev) => Math.max(prev - 4, MIN_CELL_SIZE));
  };

  const handleFitToWidth = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const rowNumberWidth = showRowNumbers ? 50 : 0;
      const availableWidth = containerWidth - rowNumberWidth - 40; // padding
      const newCellSize = Math.floor(availableWidth / chartWidth);
      setCellSize(Math.max(MIN_CELL_SIZE, Math.min(newCellSize, MAX_CELL_SIZE)));
    }
  };

  const goToFirstRow = () => {
    listRef.current?.scrollToItem(0, 'start');
  };

  const goToLastRow = () => {
    listRef.current?.scrollToItem(totalRows - 1, 'end');
  };

  const goToCurrentRow = () => {
    if (progress?.current_row !== undefined) {
      setScrollToRow(progress.current_row);
    }
  };

  // Get cell background color
  const getCellColor = useCallback(
    (cell: ChartCell, globalRow: number, col: number): string => {
      // Check if completed
      const cellKey = `${globalRow}-${col}`;
      if (completedCellsSet.has(cellKey) || completedRowsSet.has(globalRow)) {
        return 'rgba(76, 175, 80, 0.4)'; // Green for completed
      }

      // Check if current position
      if (
        highlightCurrentRow &&
        progress?.current_row === globalRow &&
        progress?.current_column === col
      ) {
        return 'rgba(33, 150, 243, 0.6)'; // Blue for current
      }

      // Check if current row
      if (highlightCurrentRow && progress?.current_row === globalRow) {
        return 'rgba(255, 235, 59, 0.3)'; // Yellow for current row
      }

      // Use cell's own color or stitch type color
      if (cell.color) return cell.color;
      if (cell.stitch_type && stitchColors[cell.stitch_type]) {
        return stitchColors[cell.stitch_type];
      }

      return '#FFFFFF';
    },
    [completedCellsSet, completedRowsSet, highlightCurrentRow, progress]
  );

  // Row renderer for virtualized list
  const RowRenderer = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const rowData = flattenedRows[index];
      if (!rowData) return null;

      const { cells, globalRow, pageNumber, isPageStart, isPageEnd } = rowData;
      const isCurrentRow = progress?.current_row === globalRow;
      const isCompleted = completedRowsSet.has(globalRow);

      return (
        <div
          style={{
            ...style,
            display: 'flex',
            alignItems: 'center',
            borderBottom: isPageEnd && showPageBreaks ? '3px solid #FF9800' : '1px solid #E0E0E0',
            borderTop: isPageStart && showPageBreaks && index > 0 ? '3px solid #FF9800' : undefined,
            backgroundColor: isCurrentRow ? 'rgba(255, 235, 59, 0.1)' : undefined,
          }}
        >
          {/* Row number */}
          {showRowNumbers && (
            <Box
              sx={{
                width: 50,
                minWidth: 50,
                textAlign: 'center',
                fontWeight: isCurrentRow ? 'bold' : 'normal',
                color: isCompleted ? 'success.main' : 'text.secondary',
                fontSize: '0.85rem',
                cursor: onRowClick ? 'pointer' : 'default',
                '&:hover': onRowClick ? { backgroundColor: 'action.hover' } : {},
              }}
              onClick={() => onRowClick?.(globalRow)}
            >
              {globalRow + 1}
            </Box>
          )}

          {/* Page indicator on page boundaries */}
          {showPageBreaks && isPageStart && (
            <Chip
              label={`P${pageNumber}`}
              size="small"
              sx={{
                position: 'absolute',
                left: showRowNumbers ? 55 : 5,
                top: -10,
                height: 18,
                fontSize: '0.7rem',
                backgroundColor: '#FF9800',
                color: 'white',
              }}
            />
          )}

          {/* Chart cells */}
          <Box sx={{ display: 'flex', gap: 0 }}>
            {cells.map((cell, colIndex) => (
              <Box
                key={colIndex}
                sx={{
                  width: cellSize,
                  height: cellSize,
                  minWidth: cellSize,
                  border: '1px solid #CCC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: getCellColor(cell, globalRow, colIndex),
                  cursor: onCellClick ? 'pointer' : 'default',
                  fontSize: cellSize > 24 ? '0.85rem' : '0.7rem',
                  fontFamily: 'monospace',
                  transition: 'background-color 0.2s',
                  '&:hover': onCellClick
                    ? {
                        outline: '2px solid #1976d2',
                        outlineOffset: -2,
                      }
                    : {},
                }}
                onClick={() => onCellClick?.(globalRow, colIndex)}
                title={`Row ${globalRow + 1}, Col ${colIndex + 1}${
                  cell.stitch_type ? ` - ${cell.stitch_type}` : ''
                }`}
              >
                {cell.symbol}
              </Box>
            ))}
          </Box>
        </div>
      );
    },
    [
      flattenedRows,
      progress,
      completedRowsSet,
      showRowNumbers,
      showPageBreaks,
      onRowClick,
      cellSize,
      getCellColor,
      onCellClick,
    ]
  );

  // Calculate list height based on container
  const [listHeight, setListHeight] = useState(400);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        // Leave room for controls (about 120px)
        const availableHeight = containerRef.current.clientHeight - 120;
        setListHeight(Math.max(200, availableHeight));
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  if (pages.length === 0) {
    return (
      <Alert severity="info">No chart pages to display</Alert>
    );
  }

  return (
    <Card ref={containerRef} sx={{ height: '100%', minHeight: 400, display: 'flex', flexDirection: 'column' }}>
      {/* Controls */}
      <Box
        sx={{
          p: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        {/* Zoom controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Zoom Out">
            <IconButton size="small" onClick={handleZoomOut} disabled={cellSize <= MIN_CELL_SIZE}>
              <ZoomOut />
            </IconButton>
          </Tooltip>
          <Slider
            value={cellSize}
            min={MIN_CELL_SIZE}
            max={MAX_CELL_SIZE}
            step={2}
            onChange={(_: Event, value: number | number[]) => setCellSize(value as number)}
            sx={{ width: 100 }}
          />
          <Tooltip title="Zoom In">
            <IconButton size="small" onClick={handleZoomIn} disabled={cellSize >= MAX_CELL_SIZE}>
              <ZoomIn />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fit to Width">
            <IconButton size="small" onClick={handleFitToWidth}>
              <FitScreen />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Navigation controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Go to First Row">
            <IconButton size="small" onClick={goToFirstRow}>
              <FirstPage />
            </IconButton>
          </Tooltip>
          <Tooltip title="Go to Previous Page">
            <IconButton
              size="small"
              onClick={() => {
                if (listRef.current) {
                  const currentScroll = (listRef.current as any)?.state?.scrollOffset || 0;
                  listRef.current.scrollTo(Math.max(0, currentScroll - listHeight));
                }
              }}
            >
              <KeyboardArrowUp />
            </IconButton>
          </Tooltip>
          <Tooltip title="Go to Next Page">
            <IconButton
              size="small"
              onClick={() => {
                if (listRef.current) {
                  const currentScroll = (listRef.current as any)?.state?.scrollOffset || 0;
                  listRef.current.scrollTo(currentScroll + listHeight);
                }
              }}
            >
              <KeyboardArrowDown />
            </IconButton>
          </Tooltip>
          <Tooltip title="Go to Last Row">
            <IconButton size="small" onClick={goToLastRow}>
              <LastPage />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Current position button */}
        {progress && (
          <Tooltip title="Go to Current Position">
            <Chip
              label={`Current: Row ${(progress.current_row || 0) + 1}`}
              color="primary"
              size="small"
              onClick={goToCurrentRow}
              sx={{ cursor: 'pointer' }}
            />
          </Tooltip>
        )}

        {/* Stats */}
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {pages.length} page{pages.length !== 1 ? 's' : ''} | {totalRows} rows | {chartWidth} cols
          </Typography>
        </Box>
      </Box>

      {/* Virtualized chart */}
      <Box sx={{ flex: 1, overflow: 'hidden', p: 1 }}>
        <List
          ref={listRef}
          height={listHeight}
          itemCount={totalRows}
          itemSize={cellSize + 2} // +2 for borders
          width="100%"
          style={{ overflowX: 'auto' }}
        >
          {RowRenderer}
        </List>
      </Box>

      {/* Legend */}
      <Box
        sx={{
          p: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
          fontSize: '0.75rem',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              backgroundColor: 'rgba(76, 175, 80, 0.4)',
              border: '1px solid #4CAF50',
            }}
          />
          <span>Completed</span>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              backgroundColor: 'rgba(255, 235, 59, 0.3)',
              border: '1px solid #FFEB3B',
            }}
          />
          <span>Current Row</span>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              backgroundColor: 'rgba(33, 150, 243, 0.6)',
              border: '1px solid #2196F3',
            }}
          />
          <span>Current Cell</span>
        </Box>
        {showPageBreaks && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 16,
                height: 3,
                backgroundColor: '#FF9800',
              }}
            />
            <span>Page Break</span>
          </Box>
        )}
      </Box>
    </Card>
  );
};

export default ContinuousChartView;
