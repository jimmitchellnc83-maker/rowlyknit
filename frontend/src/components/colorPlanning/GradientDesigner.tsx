import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  Typography,
  TextField,
  Button,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  Slider,
  Tooltip,
  Chip,
  Alert,
  CircularProgress,
  SelectChangeEvent,
} from '@mui/material';
import {
  Add,
  Delete,
  Refresh,
  Save,
  ColorLens,
} from '@mui/icons-material';

interface Color {
  id: string;
  name: string;
  hex: string;
}

interface ColorTransition {
  color_id: string;
  color_name: string;
  hex_code: string;
  start_row: number;
  end_row: number;
  percentage: number;
}

interface GradientDesignerProps {
  projectId: string;
  totalRows: number;
  onSave?: (transitions: ColorTransition[]) => void;
  initialColors?: Color[];
}

const GradientDesigner: React.FC<GradientDesignerProps> = ({
  projectId,
  totalRows,
  onSave,
  initialColors,
}) => {
  const [colors, setColors] = useState<Color[]>(
    initialColors || [
      { id: '1', name: 'Color 1', hex: '#3498db' },
      { id: '2', name: 'Color 2', hex: '#9b59b6' },
    ]
  );
  const [transitionStyle, setTransitionStyle] = useState<'linear' | 'smooth' | 'striped'>('linear');
  const [stripeWidth, setStripeWidth] = useState(4);
  const [sequence, setSequence] = useState<ColorTransition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const generateSequence = useCallback(async () => {
    if (colors.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/gradient-designer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          total_rows: totalRows,
          colors: colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex })),
          transition_style: transitionStyle,
          stripe_width: stripeWidth,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate sequence');
      }

      const data = await response.json();
      setSequence(data.color_sequence || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate gradient');
    } finally {
      setLoading(false);
    }
  }, [projectId, totalRows, colors, transitionStyle, stripeWidth]);

  useEffect(() => {
    generateSequence();
  }, [generateSequence]);

  const addColor = () => {
    if (colors.length >= 10) return;

    const newColor: Color = {
      id: Date.now().toString(),
      name: `Color ${colors.length + 1}`,
      hex: getRandomColor(),
    };
    setColors([...colors, newColor]);
  };

  const updateColor = (id: string, updates: Partial<Color>) => {
    setColors(colors.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeColor = (id: string) => {
    if (colors.length > 2) {
      setColors(colors.filter((c) => c.id !== id));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/color-transitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: 'Gradient Plan',
          transition_type: transitionStyle === 'striped' ? 'stripe' : 'gradient',
          color_sequence: sequence,
          transition_settings: {
            style: transitionStyle,
            stripe_width: stripeWidth,
          },
          total_rows: totalRows,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save gradient');
      }

      onSave?.(sequence);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save gradient');
    } finally {
      setSaving(false);
    }
  };

  const getRandomColor = (): string => {
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
  };

  return (
    <Card sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ColorLens color="primary" />
          <Typography variant="h6">Gradient Designer</Typography>
        </Box>
        <Chip label={`${totalRows} rows`} size="small" variant="outlined" />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Color List */}
      <Typography variant="subtitle2" gutterBottom>
        Colors ({colors.length}/10)
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
        {colors.map((color, idx) => (
          <Box
            key={color.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              backgroundColor: 'grey.50',
              borderRadius: 1,
            }}
          >
            {/* Color number */}
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: 'primary.main',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                fontWeight: 'bold',
              }}
            >
              {idx + 1}
            </Box>

            {/* Color picker */}
            <input
              type="color"
              value={color.hex}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateColor(color.id, { hex: e.target.value })}
              style={{
                width: 50,
                height: 36,
                border: '2px solid #ccc',
                borderRadius: 4,
                cursor: 'pointer',
                padding: 0,
              }}
            />

            {/* Color name */}
            <TextField
              value={color.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateColor(color.id, { name: e.target.value })}
              size="small"
              placeholder="Color name"
              sx={{ flex: 1 }}
            />

            {/* Hex input */}
            <TextField
              value={color.hex}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const hex = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(hex)) {
                  updateColor(color.id, { hex });
                }
              }}
              size="small"
              placeholder="#000000"
              sx={{ width: 100 }}
              inputProps={{
                style: { fontFamily: 'monospace', textTransform: 'uppercase' },
              }}
            />

            {/* Delete button */}
            {colors.length > 2 && (
              <IconButton size="small" color="error" onClick={() => removeColor(color.id)}>
                <Delete fontSize="small" />
              </IconButton>
            )}
          </Box>
        ))}

        <Button
          variant="outlined"
          startIcon={<Add />}
          onClick={addColor}
          disabled={colors.length >= 10}
          size="small"
        >
          Add Color
        </Button>
      </Box>

      {/* Transition Style */}
      <Typography variant="subtitle2" gutterBottom>
        Transition Style
      </Typography>
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <Select
          value={transitionStyle}
          onChange={(e: SelectChangeEvent) => setTransitionStyle(e.target.value as 'linear' | 'smooth' | 'striped')}
        >
          <MenuItem value="linear">Linear (even splits)</MenuItem>
          <MenuItem value="smooth">Smooth (gradual fade)</MenuItem>
          <MenuItem value="striped">Striped (repeating)</MenuItem>
        </Select>
      </FormControl>

      {/* Stripe width slider (for striped style) */}
      {transitionStyle === 'striped' && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            Stripe Width: {stripeWidth} rows
          </Typography>
          <Slider
            value={stripeWidth}
            onChange={(_: Event, value: number | number[]) => setStripeWidth(value as number)}
            min={1}
            max={20}
            valueLabelDisplay="auto"
          />
        </Box>
      )}

      {/* Generate button */}
      <Button
        variant="contained"
        startIcon={loading ? <CircularProgress size={20} /> : <Refresh />}
        onClick={generateSequence}
        disabled={loading}
        fullWidth
        sx={{ mb: 3 }}
      >
        {loading ? 'Generating...' : 'Regenerate Preview'}
      </Button>

      {/* Preview */}
      {sequence.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Preview
          </Typography>

          {/* Gradient bar */}
          <Box
            sx={{
              display: 'flex',
              height: 50,
              borderRadius: 1,
              overflow: 'hidden',
              boxShadow: 1,
              mb: 2,
            }}
          >
            {sequence.map((seg, idx) => (
              <Tooltip
                key={idx}
                title={`${seg.color_name}: rows ${seg.start_row}-${seg.end_row} (${Math.round(seg.percentage)}%)`}
              >
                <Box
                  sx={{
                    backgroundColor: seg.hex_code,
                    width: `${seg.percentage}%`,
                    minWidth: 4,
                    transition: 'opacity 0.2s',
                    '&:hover': { opacity: 0.8 },
                  }}
                />
              </Tooltip>
            ))}
          </Box>

          {/* Sequence details */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Consolidate by color for display */}
            {consolidateByColor(sequence).map((item, idx) => (
              <Box
                key={idx}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1,
                  backgroundColor: 'grey.50',
                  borderRadius: 1,
                }}
              >
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 0.5,
                    backgroundColor: item.hex_code,
                    border: '2px solid',
                    borderColor: 'divider',
                  }}
                />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight="medium">
                    {item.color_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.rows} rows ({Math.round(item.percentage)}%)
                  </Typography>
                </Box>
                <Chip
                  label={`~${Math.round(item.percentage * totalRows / 100)} rows`}
                  size="small"
                  variant="outlined"
                />
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Save button */}
      <Button
        variant="contained"
        color="success"
        startIcon={saving ? <CircularProgress size={20} /> : <Save />}
        onClick={handleSave}
        disabled={saving || sequence.length === 0}
        fullWidth
      >
        {saving ? 'Saving...' : 'Save Gradient Plan'}
      </Button>
    </Card>
  );
};

// Helper to consolidate sequence by color for display
function consolidateByColor(sequence: ColorTransition[]): Array<{
  color_id: string;
  color_name: string;
  hex_code: string;
  rows: number;
  percentage: number;
}> {
  const map = new Map<string, { color_name: string; hex_code: string; rows: number; percentage: number }>();

  for (const seg of sequence) {
    const existing = map.get(seg.color_id);
    const rows = seg.end_row - seg.start_row + 1;
    if (existing) {
      existing.rows += rows;
      existing.percentage += seg.percentage;
    } else {
      map.set(seg.color_id, {
        color_name: seg.color_name,
        hex_code: seg.hex_code,
        rows,
        percentage: seg.percentage,
      });
    }
  }

  return Array.from(map.entries()).map(([color_id, data]) => ({
    color_id,
    ...data,
  }));
}

export default GradientDesigner;
