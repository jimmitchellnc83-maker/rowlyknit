import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  RadioGroup,
  Radio,
  FormLabel,
} from '@mui/material';
import {
  Download,
  Close,
  PictureAsPdf,
  Image,
  TableChart,
  Code,
  Description,
} from '@mui/icons-material';

interface ChartExportDialogProps {
  open: boolean;
  onClose: () => void;
  chartId: string;
  chartName: string;
}

type ExportFormat = 'pdf' | 'png' | 'csv' | 'ravelry' | 'markdown';

const formatInfo: Record<ExportFormat, { icon: JSX.Element; name: string; description: string }> = {
  pdf: {
    icon: <PictureAsPdf />,
    name: 'PDF',
    description: 'Print-ready document',
  },
  png: {
    icon: <Image />,
    name: 'PNG Image',
    description: 'High-resolution image',
  },
  csv: {
    icon: <TableChart />,
    name: 'CSV',
    description: 'Spreadsheet format',
  },
  ravelry: {
    icon: <Code />,
    name: 'Ravelry JSON',
    description: 'Import to Ravelry',
  },
  markdown: {
    icon: <Description />,
    name: 'Markdown',
    description: 'Text format for blogs',
  },
};

const ChartExportDialog: React.FC<ChartExportDialogProps> = ({
  open,
  onClose,
  chartId,
  chartName,
}) => {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [pageSize, setPageSize] = useState<'letter' | 'a4' | 'legal'>('letter');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [cellSize, setCellSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [includeLegend, setIncludeLegend] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeRowNumbers, setIncludeRowNumbers] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/charts/${chartId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          format,
          options: {
            page_size: pageSize,
            orientation,
            cell_size: cellSize,
            include_legend: includeLegend,
            include_notes: includeNotes,
            include_row_numbers: includeRowNumbers,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${chartName.replace(/[^a-z0-9]/gi, '_')}.${format === 'ravelry' ? 'json' : format === 'markdown' ? 'md' : format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Download />
          <Typography variant="h6">Export Chart</Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Exporting: <strong>{chartName}</strong>
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Format selection */}
        <Box sx={{ mb: 3 }}>
          <FormControl component="fieldset">
            <FormLabel component="legend">Export Format</FormLabel>
            <RadioGroup
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
            >
              {(Object.keys(formatInfo) as ExportFormat[]).map((f) => (
                <FormControlLabel
                  key={f}
                  value={f}
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {formatInfo[f].icon}
                      <Box>
                        <Typography variant="body2">{formatInfo[f].name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatInfo[f].description}
                        </Typography>
                      </Box>
                    </Box>
                  }
                />
              ))}
            </RadioGroup>
          </FormControl>
        </Box>

        {/* PDF/PNG options */}
        {(format === 'pdf' || format === 'png') && (
          <>
            {format === 'pdf' && (
              <>
                {/* Page size */}
                <Box sx={{ mb: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Page Size</InputLabel>
                    <Select
                      value={pageSize}
                      label="Page Size"
                      onChange={(e) => setPageSize(e.target.value as any)}
                    >
                      <MenuItem value="letter">Letter (8.5" x 11")</MenuItem>
                      <MenuItem value="a4">A4</MenuItem>
                      <MenuItem value="legal">Legal (8.5" x 14")</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                {/* Orientation */}
                <Box sx={{ mb: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Orientation</InputLabel>
                    <Select
                      value={orientation}
                      label="Orientation"
                      onChange={(e) => setOrientation(e.target.value as any)}
                    >
                      <MenuItem value="portrait">Portrait</MenuItem>
                      <MenuItem value="landscape">Landscape</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </>
            )}

            {/* Cell size */}
            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Cell Size</InputLabel>
                <Select
                  value={cellSize}
                  label="Cell Size"
                  onChange={(e) => setCellSize(e.target.value as any)}
                >
                  <MenuItem value="small">Small</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="large">Large</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Include options */}
            <Box sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={includeLegend}
                    onChange={(e) => setIncludeLegend(e.target.checked)}
                  />
                }
                label="Include legend"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={includeRowNumbers}
                    onChange={(e) => setIncludeRowNumbers(e.target.checked)}
                  />
                }
                label="Include row numbers"
              />
              {format === 'pdf' && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={includeNotes}
                      onChange={(e) => setIncludeNotes(e.target.checked)}
                    />
                  }
                  label="Include notes"
                />
              )}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <Download />}
        >
          {loading ? 'Exporting...' : 'Export'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChartExportDialog;
