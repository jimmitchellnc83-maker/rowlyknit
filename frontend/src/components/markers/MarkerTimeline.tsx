import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  Typography,
  Tooltip,
  IconButton,
  Popover,
  Chip,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  Close,
  Edit,
  Delete,
  MyLocation,
  ZoomIn,
  ZoomOut,
} from '@mui/icons-material';

interface TimelineMarker {
  id: string;
  name: string;
  row_position: number;
  type: string;
  color: string;
  status: 'upcoming' | 'active' | 'completed';
  message?: string;
}

interface MarkerTimelineProps {
  projectId: string;
  currentRow: number;
  totalRows: number;
  onMarkerClick?: (marker: TimelineMarker) => void;
  onMarkerEdit?: (markerId: string) => void;
  onMarkerDelete?: (markerId: string) => void;
  onMarkerDrag?: (markerId: string, newPosition: number) => void;
  refreshTrigger?: number;
}

// Color mapping for marker statuses
const statusColors: Record<string, string> = {
  completed: '#10b981', // green
  active: '#f59e0b', // yellow/amber
  upcoming: '#3b82f6', // blue
};

// Color mapping for marker types
const typeColors: Record<string, string> = {
  blue: '#3b82f6',
  green: '#10b981',
  yellow: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  gray: '#6b7280',
};

const MarkerTimeline: React.FC<MarkerTimelineProps> = ({
  projectId,
  currentRow,
  totalRows,
  onMarkerClick,
  onMarkerEdit,
  onMarkerDelete,
  onMarkerDrag,
  refreshTrigger,
}) => {
  const [markers, setMarkers] = useState<TimelineMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<TimelineMarker | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [draggingMarker, setDraggingMarker] = useState<string | null>(null);

  // Fetch timeline data
  const fetchTimeline = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/marker-timeline`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch timeline');
      }

      const data = await response.json();
      setMarkers(data.markers || []);
      setError(null);
    } catch (err) {
      setError('Failed to load marker timeline');
      console.error('Timeline fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline, refreshTrigger]);

  // Calculate marker position as percentage
  const getMarkerPosition = (rowPosition: number): number => {
    if (totalRows <= 0) return 0;
    return Math.min(100, Math.max(0, (rowPosition / totalRows) * 100));
  };

  // Get marker display color
  const getMarkerColor = (marker: TimelineMarker): string => {
    // Use custom color if set, otherwise use status color
    if (marker.color && typeColors[marker.color]) {
      return typeColors[marker.color];
    }
    return statusColors[marker.status] || '#6b7280';
  };

  // Handle marker click
  const handleMarkerClick = (
    event: React.MouseEvent<HTMLElement>,
    marker: TimelineMarker
  ) => {
    setSelectedMarker(marker);
    setAnchorEl(event.currentTarget);
    onMarkerClick?.(marker);
  };

  // Close popover
  const handleClosePopover = () => {
    setSelectedMarker(null);
    setAnchorEl(null);
  };

  // Handle drag start
  const handleDragStart = (markerId: string) => {
    if (onMarkerDrag) {
      setDraggingMarker(markerId);
    }
  };

  // Handle drag
  const handleDrag = (event: React.MouseEvent<HTMLElement>) => {
    if (!draggingMarker || !onMarkerDrag) return;

    const track = event.currentTarget.closest('.timeline-track');
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const percentage = (event.clientX - rect.left) / rect.width;
    const newPosition = Math.max(1, Math.min(totalRows, Math.round(percentage * totalRows)));

    // Update local state immediately for smooth UX
    setMarkers((prev) =>
      prev.map((m) =>
        m.id === draggingMarker ? { ...m, row_position: newPosition } : m
      )
    );
  };

  // Handle drag end
  const handleDragEnd = () => {
    if (draggingMarker) {
      const marker = markers.find((m) => m.id === draggingMarker);
      if (marker) {
        onMarkerDrag?.(draggingMarker, marker.row_position);
      }
      setDraggingMarker(null);
    }
  };

  // Group markers that are close together
  const groupedMarkers = markers.reduce<TimelineMarker[][]>((acc, marker) => {
    const threshold = totalRows * 0.02 / zoom; // 2% of total rows
    const lastGroup = acc[acc.length - 1];

    if (
      lastGroup &&
      Math.abs(lastGroup[0].row_position - marker.row_position) <= threshold
    ) {
      lastGroup.push(marker);
    } else {
      acc.push([marker]);
    }

    return acc;
  }, []);

  if (loading) {
    return (
      <Card sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Marker Timeline
        </Typography>
        <LinearProgress />
      </Card>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Card sx={{ p: 2 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="subtitle1" fontWeight="medium">
          Marker Timeline
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Row {currentRow} of {totalRows}
          </Typography>
          <IconButton size="small" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
            <ZoomOut fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
            <ZoomIn fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Timeline Track */}
      <Box
        className="timeline-track"
        sx={{
          position: 'relative',
          height: 60,
          backgroundColor: 'grey.100',
          borderRadius: 1,
          mb: 1,
          cursor: draggingMarker ? 'grabbing' : 'default',
          overflow: 'hidden',
        }}
        onMouseMove={draggingMarker ? handleDrag : undefined}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        {/* Progress gradient */}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${getMarkerPosition(currentRow)}%`,
            background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.2) 100%)',
            borderRadius: 1,
          }}
        />

        {/* Current position indicator */}
        <Box
          sx={{
            position: 'absolute',
            left: `${getMarkerPosition(currentRow)}%`,
            top: 0,
            height: '100%',
            width: 3,
            backgroundColor: 'error.main',
            transform: 'translateX(-50%)',
            zIndex: 10,
            boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
          }}
        />

        {/* Current position label */}
        <Tooltip title="Current position">
          <Box
            sx={{
              position: 'absolute',
              left: `${getMarkerPosition(currentRow)}%`,
              bottom: -28,
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              zIndex: 11,
            }}
          >
            <MyLocation sx={{ fontSize: 14, color: 'error.main' }} />
            <Typography variant="caption" color="error.main" fontWeight="semibold">
              Here
            </Typography>
          </Box>
        </Tooltip>

        {/* Markers */}
        {groupedMarkers.map((group, groupIndex) => {
          const firstMarker = group[0];
          const position = getMarkerPosition(firstMarker.row_position);
          const isGrouped = group.length > 1;

          return (
            <Tooltip
              key={groupIndex}
              title={
                isGrouped
                  ? `${group.length} markers at rows ${group.map((m) => m.row_position).join(', ')}`
                  : `${firstMarker.name} (Row ${firstMarker.row_position})`
              }
            >
              <Box
                sx={{
                  position: 'absolute',
                  left: `${position}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: isGrouped ? 28 : 20,
                  height: isGrouped ? 28 : 20,
                  borderRadius: '50%',
                  backgroundColor: getMarkerColor(firstMarker),
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  cursor: onMarkerDrag ? 'grab' : 'pointer',
                  transition: draggingMarker === firstMarker.id ? 'none' : 'transform 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: draggingMarker === firstMarker.id ? 20 : 5,
                  '&:hover': {
                    transform: 'translate(-50%, -50%) scale(1.2)',
                  },
                }}
                onClick={(e) => handleMarkerClick(e, firstMarker)}
                onMouseDown={() => handleDragStart(firstMarker.id)}
              >
                {isGrouped && (
                  <Typography
                    variant="caption"
                    sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.7rem' }}
                  >
                    {group.length}
                  </Typography>
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {/* Row scale */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mt: 3,
          px: 0.5,
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <Typography key={fraction} variant="caption" color="text.secondary">
            Row {Math.round(fraction * totalRows) || 1}
          </Typography>
        ))}
      </Box>

      {/* Legend */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          justifyContent: 'center',
          mt: 2,
          pt: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        {[
          { status: 'completed', label: 'Completed', color: statusColors.completed },
          { status: 'active', label: 'Active', color: statusColors.active },
          { status: 'upcoming', label: 'Upcoming', color: statusColors.upcoming },
        ].map((item) => (
          <Box key={item.status} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: item.color,
              }}
            />
            <Typography variant="caption">{item.label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Marker count summary */}
      <Box sx={{ mt: 1, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          {markers.filter((m) => m.status === 'upcoming').length} upcoming |{' '}
          {markers.filter((m) => m.status === 'active').length} active |{' '}
          {markers.filter((m) => m.status === 'completed').length} completed
        </Typography>
      </Box>

      {/* Marker detail popover */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClosePopover}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
      >
        {selectedMarker && (
          <Box sx={{ p: 2, minWidth: 200 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                mb: 1,
              }}
            >
              <Typography variant="subtitle2">{selectedMarker.name}</Typography>
              <IconButton size="small" onClick={handleClosePopover}>
                <Close fontSize="small" />
              </IconButton>
            </Box>

            <Typography variant="body2" color="text.secondary" gutterBottom>
              Row: {selectedMarker.row_position}
            </Typography>

            {selectedMarker.message && (
              <Typography variant="body2" sx={{ mb: 1 }}>
                {selectedMarker.message}
              </Typography>
            )}

            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Chip
                label={selectedMarker.type}
                size="small"
                variant="outlined"
              />
              <Chip
                label={selectedMarker.status}
                size="small"
                sx={{
                  backgroundColor: statusColors[selectedMarker.status],
                  color: 'white',
                }}
              />
            </Box>

            {(onMarkerEdit || onMarkerDelete) && (
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                {onMarkerEdit && (
                  <IconButton
                    size="small"
                    onClick={() => {
                      onMarkerEdit(selectedMarker.id);
                      handleClosePopover();
                    }}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                )}
                {onMarkerDelete && (
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => {
                      onMarkerDelete(selectedMarker.id);
                      handleClosePopover();
                    }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                )}
              </Box>
            )}
          </Box>
        )}
      </Popover>
    </Card>
  );
};

export default MarkerTimeline;
