import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  LinearProgress,
  Alert,
  Grid,
  TextField,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  CloudUpload,
  PhotoCamera,
  Image,
  Close,
  Save,
  Refresh,
} from '@mui/icons-material';

interface DetectedChart {
  grid: string[][];
  confidence: number;
  grid_dimensions: { rows: number; cols: number };
  unrecognized_symbols: Array<{ row: number; col: number }>;
}

interface ChartImageUploadProps {
  projectId?: string;
  onChartCreated?: (chart: any) => void;
  onCancel?: () => void;
}

interface CorrectionDialogState {
  open: boolean;
  row: number;
  col: number;
  currentSymbol: string;
}

// Common knitting symbols for correction dropdown
const SYMBOL_OPTIONS = [
  { value: 'k', label: 'Knit (k)' },
  { value: 'p', label: 'Purl (p)' },
  { value: 'yo', label: 'Yarn Over (yo)' },
  { value: 'k2tog', label: 'K2tog (/)' },
  { value: 'ssk', label: 'SSK (\\)' },
  { value: 'sl', label: 'Slip (sl)' },
  { value: 'm1l', label: 'Make 1 Left' },
  { value: 'm1r', label: 'Make 1 Right' },
  { value: 'kfb', label: 'Knit Front Back' },
  { value: 'c4f', label: 'Cable 4 Front' },
  { value: 'c4b', label: 'Cable 4 Back' },
  { value: 'x', label: 'No Stitch (x)' },
];

const ChartImageUpload: React.FC<ChartImageUploadProps> = ({
  projectId,
  onChartCreated,
  onCancel,
}) => {
  const [uploading, setUploading] = useState(false);
  const [detected, setDetected] = useState<DetectedChart | null>(null);
  const [detectionId, setDetectionId] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [chartName, setChartName] = useState('Imported Chart');
  const [corrections, setCorrections] = useState<
    Array<{ row: number; col: number; original: string; corrected: string }>
  >([]);
  const [correctionDialog, setCorrectionDialog] = useState<CorrectionDialogState>({
    open: false,
    row: 0,
    col: 0,
    currentSymbol: '',
  });
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setDetected(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      if (projectId) {
        formData.append('project_id', projectId);
      }

      const response = await fetch('/api/charts/detect-from-image', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Detection failed');
      }

      const data = await response.json();
      setDetected(data.detected_chart);
      setDetectionId(data.detection_id);
      setOriginalImageUrl(data.original_image_url);
      setCorrections([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect chart from image');
    } finally {
      setUploading(false);
    }
  }, [projectId]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleCellClick = (row: number, col: number) => {
    if (!detected) return;

    const currentSymbol = detected.grid[row]?.[col] || 'k';
    setCorrectionDialog({
      open: true,
      row,
      col,
      currentSymbol,
    });
  };

  const handleCorrectionSubmit = (newSymbol: string) => {
    if (!detected) return;

    const { row, col, currentSymbol } = correctionDialog;

    // Add correction
    setCorrections((prev) => [
      ...prev.filter((c) => !(c.row === row && c.col === col)),
      { row, col, original: currentSymbol, corrected: newSymbol },
    ]);

    // Update detected grid locally
    setDetected((prev) => {
      if (!prev) return null;
      const newGrid = prev.grid.map((r) => [...r]);
      newGrid[row][col] = newSymbol;
      return {
        ...prev,
        grid: newGrid,
        unrecognized_symbols: prev.unrecognized_symbols.filter(
          (u) => !(u.row === row && u.col === col)
        ),
      };
    });

    setCorrectionDialog({ open: false, row: 0, col: 0, currentSymbol: '' });
  };

  const handleSave = async () => {
    if (!detected || !detectionId) return;

    setSaving(true);
    setError(null);

    try {
      // Apply corrections first if any
      if (corrections.length > 0) {
        await fetch(`/api/charts/detection/${detectionId}/correct`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ corrections }),
        });
      }

      // Save chart
      const response = await fetch('/api/charts/save-detected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          detection_id: detectionId,
          project_id: projectId,
          chart_name: chartName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save chart');
      }

      const data = await response.json();
      onChartCreated?.(data.chart);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save chart');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDetected(null);
    setDetectionId(null);
    setOriginalImageUrl('');
    setCorrections([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getCellBackground = (row: number, col: number): string => {
    // Check if this cell was corrected
    if (corrections.some((c) => c.row === row && c.col === col)) {
      return 'rgba(76, 175, 80, 0.3)'; // Green for corrected
    }

    // Check if this cell is unrecognized
    if (detected?.unrecognized_symbols.some((u) => u.row === row && u.col === col)) {
      return 'rgba(255, 152, 0, 0.3)'; // Orange for unrecognized
    }

    return 'white';
  };

  return (
    <Card sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Import Chart from Image
      </Typography>

      {/* Error display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Upload zone */}
      {!detected && (
        <Box
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          sx={{
            border: '2px dashed',
            borderColor: 'primary.main',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            disabled={uploading}
          />

          {uploading ? (
            <Box>
              <Typography variant="body1" gutterBottom>
                Analyzing image...
              </Typography>
              <LinearProgress sx={{ mt: 2, maxWidth: 300, mx: 'auto' }} />
            </Box>
          ) : (
            <Box>
              <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="body1" gutterBottom>
                Drag and drop a chart image here
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                or click to browse
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 2 }}>
                <Chip icon={<Image />} label="PNG" size="small" />
                <Chip icon={<Image />} label="JPG" size="small" />
                <Chip icon={<PhotoCamera />} label="Photo" size="small" />
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Detection results */}
      {detected && (
        <Box>
          {/* Confidence score */}
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2">
              Detection confidence:{' '}
              <strong>{Math.round(detected.confidence * 100)}%</strong>
            </Typography>
            <Chip
              label={`${detected.grid_dimensions.rows} rows × ${detected.grid_dimensions.cols} cols`}
              size="small"
            />
            {detected.unrecognized_symbols.length > 0 && (
              <Chip
                label={`${detected.unrecognized_symbols.length} cells need review`}
                color="warning"
                size="small"
              />
            )}
          </Box>

          {/* Side by side view */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {/* Original image */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Original Image
              </Typography>
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  overflow: 'hidden',
                  maxHeight: 400,
                }}
              >
                <img
                  src={originalImageUrl}
                  alt="Original chart"
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: 400,
                    objectFit: 'contain',
                  }}
                />
              </Box>
            </Grid>

            {/* Detected chart */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Detected Chart (click cells to correct)
              </Typography>
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  overflow: 'auto',
                  maxHeight: 400,
                  p: 1,
                }}
              >
                <Box
                  sx={{
                    display: 'inline-block',
                    minWidth: 'fit-content',
                  }}
                >
                  {detected.grid.map((row, rowIdx) => (
                    <Box key={rowIdx} sx={{ display: 'flex' }}>
                      {row.map((cell, colIdx) => (
                        <Tooltip
                          key={colIdx}
                          title={`Row ${rowIdx + 1}, Col ${colIdx + 1}: ${cell}`}
                        >
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              minWidth: 24,
                              border: '1px solid #ccc',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.7rem',
                              fontFamily: 'monospace',
                              cursor: 'pointer',
                              backgroundColor: getCellBackground(rowIdx, colIdx),
                              '&:hover': {
                                outline: '2px solid #1976d2',
                                outlineOffset: -2,
                              },
                            }}
                            onClick={() => handleCellClick(rowIdx, colIdx)}
                          >
                            {cell}
                          </Box>
                        </Tooltip>
                      ))}
                    </Box>
                  ))}
                </Box>
              </Box>
            </Grid>
          </Grid>

          {/* Legend */}
          <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  backgroundColor: 'rgba(255, 152, 0, 0.3)',
                  border: '1px solid #ccc',
                }}
              />
              <Typography variant="caption">Needs review</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  backgroundColor: 'rgba(76, 175, 80, 0.3)',
                  border: '1px solid #ccc',
                }}
              />
              <Typography variant="caption">Corrected</Typography>
            </Box>
          </Box>

          {/* Chart name input */}
          <TextField
            label="Chart Name"
            value={chartName}
            onChange={(e) => setChartName(e.target.value)}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
          />

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleReset}
              disabled={saving}
            >
              Try Again
            </Button>
            {onCancel && (
              <Button
                variant="outlined"
                startIcon={<Close />}
                onClick={onCancel}
                disabled={saving}
              >
                Cancel
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Chart'}
            </Button>
          </Box>
        </Box>
      )}

      {/* Correction dialog */}
      <Dialog
        open={correctionDialog.open}
        onClose={() => setCorrectionDialog({ open: false, row: 0, col: 0, currentSymbol: '' })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          Correct Symbol (Row {correctionDialog.row + 1}, Col {correctionDialog.col + 1})
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Current: <strong>{correctionDialog.currentSymbol}</strong>
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Select correct symbol</InputLabel>
            <Select
              label="Select correct symbol"
              defaultValue={correctionDialog.currentSymbol}
              onChange={(e) => handleCorrectionSubmit(e.target.value as string)}
            >
              {SYMBOL_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setCorrectionDialog({ open: false, row: 0, col: 0, currentSymbol: '' })
            }
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default ChartImageUpload;
