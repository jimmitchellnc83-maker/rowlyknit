import React, { useState, useCallback } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  LinearProgress,
  Alert,
  Chip,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Psychology,
  Check,
  Close,
  ExpandMore,
  ExpandLess,
  AutoAwesome,
} from '@mui/icons-material';

interface MarkerSuggestion {
  type: 'counter_value' | 'row_range' | 'row_interval';
  name: string;
  start_row: number;
  end_row?: number;
  repeat_interval?: number;
  message: string;
  confidence: number;
  reason: string;
}

interface PatternAnalysisPanelProps {
  projectId: string;
  onAcceptSuggestion?: (suggestion: MarkerSuggestion) => void;
  onAnalysisComplete?: (suggestions: MarkerSuggestion[]) => void;
}

const PatternAnalysisPanel: React.FC<PatternAnalysisPanelProps> = ({
  projectId,
  onAcceptSuggestion,
  onAnalysisComplete,
}) => {
  const [suggestions, setSuggestions] = useState<MarkerSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>('');
  const [expanded, setExpanded] = useState(true);

  const analyzePattern = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/analyze-markers`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Analysis failed');
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
      setSummary(data.summary || '');
      setAnalyzed(true);
      onAnalysisComplete?.(data.suggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pattern analysis failed');
    } finally {
      setLoading(false);
    }
  }, [projectId, onAnalysisComplete]);

  const handleAccept = async (suggestion: MarkerSuggestion) => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/accept-marker-suggestion`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ suggestion }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to accept suggestion');
      }

      // Remove accepted suggestion from list
      setSuggestions((prev) => prev.filter((s) => s !== suggestion));
      onAcceptSuggestion?.(suggestion);
    } catch (err) {
      console.error('Failed to accept suggestion:', err);
    }
  };

  const handleDismiss = (suggestion: MarkerSuggestion) => {
    setSuggestions((prev) => prev.filter((s) => s !== suggestion));
  };

  const getConfidenceLevel = (confidence: number): 'high' | 'medium' | 'low' => {
    if (confidence >= 0.85) return 'high';
    if (confidence >= 0.7) return 'medium';
    return 'low';
  };

  const getConfidenceColor = (level: 'high' | 'medium' | 'low'): string => {
    switch (level) {
      case 'high':
        return '#10b981';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#3b82f6';
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'counter_value':
        return 'Single Row';
      case 'row_range':
        return 'Row Range';
      case 'row_interval':
        return 'Repeating';
      default:
        return type;
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'counter_value':
        return 'primary';
      case 'row_range':
        return 'warning';
      case 'row_interval':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          '&:hover': { backgroundColor: 'action.hover' },
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Psychology color="primary" />
          <Typography variant="subtitle1" fontWeight="medium">
            Pattern Analysis
          </Typography>
          {analyzed && suggestions.length > 0 && (
            <Chip
              label={`${suggestions.length} suggestions`}
              size="small"
              color="primary"
            />
          )}
        </Box>
        <IconButton size="small">
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2 }}>
          {/* Error message */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Loading state */}
          {loading && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Analyzing pattern text for potential markers...
              </Typography>
              <LinearProgress />
            </Box>
          )}

          {/* Not yet analyzed */}
          {!analyzed && !loading && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <AutoAwesome sx={{ fontSize: 48, color: 'primary.light', mb: 1 }} />
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Analyze your pattern to automatically suggest helpful markers
              </Typography>
              <Button
                variant="contained"
                startIcon={<Psychology />}
                onClick={analyzePattern}
                sx={{ mt: 1 }}
              >
                Analyze Pattern
              </Button>
            </Box>
          )}

          {/* Analysis summary */}
          {analyzed && summary && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {summary}
            </Alert>
          )}

          {/* No suggestions found */}
          {analyzed && suggestions.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Check sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
              <Typography variant="body1" gutterBottom>
                No additional markers suggested
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your pattern looks well-organized!
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={analyzePattern}
                sx={{ mt: 2 }}
              >
                Re-analyze
              </Button>
            </Box>
          )}

          {/* Suggestions list */}
          {suggestions.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {suggestions.map((suggestion, idx) => {
                const confidenceLevel = getConfidenceLevel(suggestion.confidence);
                const confidenceColor = getConfidenceColor(confidenceLevel);

                return (
                  <Card
                    key={idx}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderLeft: `4px solid ${confidenceColor}`,
                    }}
                  >
                    {/* Suggestion header */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 1,
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight="medium">
                        {suggestion.name}
                      </Typography>
                      <Chip
                        label={`${Math.round(suggestion.confidence * 100)}% match`}
                        size="small"
                        sx={{
                          backgroundColor: `${confidenceColor}20`,
                          color: confidenceColor,
                          fontWeight: 'medium',
                        }}
                      />
                    </Box>

                    {/* Message */}
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {suggestion.message}
                    </Typography>

                    {/* Details */}
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 1,
                        mb: 1,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Chip
                        label={getTypeLabel(suggestion.type)}
                        size="small"
                        color={getTypeColor(suggestion.type) as any}
                        variant="outlined"
                      />
                      <Chip
                        label={`Row ${suggestion.start_row}`}
                        size="small"
                        variant="outlined"
                      />
                      {suggestion.end_row && (
                        <Chip
                          label={`to Row ${suggestion.end_row}`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                      {suggestion.repeat_interval && (
                        <Chip
                          label={`Every ${suggestion.repeat_interval} rows`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>

                    {/* Reason */}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontStyle: 'italic', display: 'block', mb: 1.5 }}
                    >
                      {suggestion.reason}
                    </Typography>

                    {/* Actions */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<Check />}
                        onClick={() => handleAccept(suggestion)}
                      >
                        Add Marker
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Close />}
                        onClick={() => handleDismiss(suggestion)}
                      >
                        Dismiss
                      </Button>
                    </Box>
                  </Card>
                );
              })}
            </Box>
          )}

          {/* Re-analyze button when there are suggestions */}
          {analyzed && suggestions.length > 0 && (
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button
                variant="text"
                size="small"
                onClick={analyzePattern}
                disabled={loading}
              >
                Re-analyze Pattern
              </Button>
            </Box>
          )}
        </Box>
      </Collapse>
    </Card>
  );
};

export default PatternAnalysisPanel;
