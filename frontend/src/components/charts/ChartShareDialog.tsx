import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Alert,
  Divider,
  CircularProgress,
  Tooltip,
  SelectChangeEvent,
} from '@mui/material';
import {
  Share,
  ContentCopy,
  Download,
  Lock,
  Public,
  Close,
  Check,
} from '@mui/icons-material';

interface ChartShareDialogProps {
  open: boolean;
  onClose: () => void;
  chartId: string;
  chartName: string;
}

interface ShareResult {
  share_url: string;
  share_token: string;
  qr_code: string;
  expires_at?: string;
}

const ChartShareDialog: React.FC<ChartShareDialogProps> = ({
  open,
  onClose,
  chartId,
  chartName,
}) => {
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [allowCopy, setAllowCopy] = useState(false);
  const [allowDownload, setAllowDownload] = useState(true);
  const [expiresInDays, setExpiresInDays] = useState<number | ''>('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateShare = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/charts/${chartId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visibility,
          allow_copy: allowCopy,
          allow_download: allowDownload,
          expires_in_days: expiresInDays || undefined,
          password: usePassword && password ? password : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create share link');
      }

      const data = await response.json();
      setShareResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareResult) return;

    try {
      await navigator.clipboard.writeText(shareResult.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownloadQR = () => {
    if (!shareResult?.qr_code) return;

    const link = document.createElement('a');
    link.href = shareResult.qr_code;
    link.download = `${chartName.replace(/[^a-z0-9]/gi, '_')}_qr.png`;
    link.click();
  };

  const handleClose = () => {
    setShareResult(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Share />
          <Typography variant="h6">Share Chart</Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* Chart name */}
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Sharing: <strong>{chartName}</strong>
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Share result */}
        {shareResult ? (
          <Box>
            <Alert severity="success" sx={{ mb: 2 }}>
              Share link created successfully!
            </Alert>

            {/* Share URL */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Share Link
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  value={shareResult.share_url}
                  fullWidth
                  size="small"
                  InputProps={{ readOnly: true }}
                />
                <Tooltip title={copied ? 'Copied!' : 'Copy link'}>
                  <IconButton
                    color={copied ? 'success' : 'primary'}
                    onClick={handleCopyLink}
                  >
                    {copied ? <Check /> : <ContentCopy />}
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* QR Code */}
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                QR Code
              </Typography>
              <Box
                component="img"
                src={shareResult.qr_code}
                alt="QR Code"
                sx={{
                  width: 180,
                  height: 180,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              />
              <Box sx={{ mt: 1 }}>
                <Button
                  size="small"
                  startIcon={<Download />}
                  onClick={handleDownloadQR}
                >
                  Download QR Code
                </Button>
              </Box>
            </Box>

            {/* Expiration */}
            {shareResult.expires_at && (
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Expires: {new Date(shareResult.expires_at).toLocaleDateString()}
              </Typography>
            )}

            <Divider sx={{ my: 2 }} />

            <Button variant="outlined" fullWidth onClick={() => setShareResult(null)}>
              Create Another Link
            </Button>
          </Box>
        ) : (
          <Box>
            {/* Visibility */}
            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Visibility</InputLabel>
                <Select
                  value={visibility}
                  label="Visibility"
                  onChange={(e: SelectChangeEvent) => setVisibility(e.target.value as 'public' | 'private')}
                >
                  <MenuItem value="public">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Public fontSize="small" />
                      Public - Anyone with link can view
                    </Box>
                  </MenuItem>
                  <MenuItem value="private">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Lock fontSize="small" />
                      Private - Requires RowlyKnit account
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Permissions */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Permissions
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={allowDownload}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAllowDownload(e.target.checked)}
                  />
                }
                label="Allow download"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={allowCopy}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAllowCopy(e.target.checked)}
                  />
                }
                label="Allow copy to account"
              />
            </Box>

            {/* Expiration */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Expiration (optional)
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={expiresInDays}
                  displayEmpty
                  onChange={(e: SelectChangeEvent<number | ''>) => setExpiresInDays(e.target.value as number | '')}
                >
                  <MenuItem value="">Never expires</MenuItem>
                  <MenuItem value={1}>1 day</MenuItem>
                  <MenuItem value={7}>1 week</MenuItem>
                  <MenuItem value={30}>1 month</MenuItem>
                  <MenuItem value={90}>3 months</MenuItem>
                  <MenuItem value={365}>1 year</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Password protection */}
            <Box sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={usePassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsePassword(e.target.checked)}
                  />
                }
                label="Password protect"
              />
              {usePassword && (
                <TextField
                  type="password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  fullWidth
                  size="small"
                  sx={{ mt: 1 }}
                />
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      {!shareResult && (
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateShare}
            disabled={loading || (usePassword && password.length < 4)}
            startIcon={loading ? <CircularProgress size={20} /> : <Share />}
          >
            {loading ? 'Creating...' : 'Create Share Link'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default ChartShareDialog;
