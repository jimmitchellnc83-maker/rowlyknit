import { Request, Response } from 'express';
import ravelryOAuthService, { InvalidOAuthStateError } from '../services/ravelryOAuthService';
import logger from '../config/logger';

export async function getAuthorizationUrl(req: Request, res: Response) {
  try {
    const url = await ravelryOAuthService.generateAuthorizationUrl(req.user!.userId);
    res.json({ success: true, data: { url } });
  } catch (error: any) {
    logger.error('Failed to generate Ravelry auth URL', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to initiate Ravelry connection. Please try again.',
    });
  }
}

export async function handleCallback(req: Request, res: Response) {
  const { code, state } = req.body;

  if (!code || !state) {
    return res.status(400).json({
      success: false,
      message: 'Authorization code and state are required.',
    });
  }

  try {
    const result = await ravelryOAuthService.exchangeCodeForTokens(code, state);
    res.json({
      success: true,
      data: { ravelryUsername: result.ravelryUsername },
    });
  } catch (error: any) {
    if (error instanceof InvalidOAuthStateError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    logger.error('Ravelry OAuth callback failed', { error: error.message });
    res.status(502).json({
      success: false,
      message: 'Failed to connect to Ravelry. Please try again.',
    });
  }
}

export async function getConnectionStatus(req: Request, res: Response) {
  const status = await ravelryOAuthService.getConnectionStatus(req.user!.userId);
  res.json({ success: true, data: status });
}

export async function disconnect(req: Request, res: Response) {
  await ravelryOAuthService.disconnectUser(req.user!.userId);
  res.json({ success: true, message: 'Ravelry account disconnected.' });
}
