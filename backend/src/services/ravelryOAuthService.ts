import axios from 'axios';
import crypto from 'crypto';
import db from '../config/database';
import { redisClient } from '../config/redis';
import { encrypt, decrypt } from '../utils/encryption';
import logger from '../config/logger';

const RAVELRY_AUTH_URL = 'https://www.ravelry.com/oauth2/auth';
const RAVELRY_TOKEN_URL = 'https://www.ravelry.com/oauth2/token';
const STATE_TTL = 600; // 10 minutes
const TOKEN_REFRESH_BUFFER = 300; // Refresh 5 minutes before expiry

class RavelryOAuthService {
  private getConfig() {
    const clientId = process.env.RAVELRY_CLIENT_ID;
    const clientSecret = process.env.RAVELRY_CLIENT_SECRET;
    const redirectUri = process.env.RAVELRY_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Ravelry OAuth is not configured. Set RAVELRY_CLIENT_ID, RAVELRY_CLIENT_SECRET, and RAVELRY_REDIRECT_URI.');
    }

    return { clientId, clientSecret, redirectUri };
  }

  async generateAuthorizationUrl(userId: string): Promise<string> {
    const { clientId, redirectUri } = this.getConfig();
    const state = crypto.randomBytes(32).toString('hex');

    await redisClient.set(`ravelry_oauth_state:${state}`, userId, 'EX', STATE_TTL);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'offline',
      state,
    });

    return `${RAVELRY_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, state: string): Promise<{ ravelryUsername: string | null }> {
    const { clientId, clientSecret, redirectUri } = this.getConfig();

    // Validate and consume state
    const userId = await redisClient.get(`ravelry_oauth_state:${state}`);
    if (!userId) {
      throw new InvalidOAuthStateError();
    }
    await redisClient.del(`ravelry_oauth_state:${state}`);

    // Exchange code for tokens
    const tokenResponse = await axios.post(RAVELRY_TOKEN_URL, new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });

    const { access_token, refresh_token, expires_in, token_type, scope } = tokenResponse.data;

    if (!access_token) {
      throw new Error('Ravelry token exchange did not return an access token');
    }

    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

    // Try to get Ravelry username
    let ravelryUsername: string | null = null;
    try {
      const userResponse = await axios.get('https://api.ravelry.com/current_user.json', {
        headers: { Authorization: `Bearer ${access_token}` },
        timeout: 10000,
      });
      ravelryUsername = userResponse.data?.user?.username || null;
    } catch {
      logger.warn('Could not fetch Ravelry username after OAuth');
    }

    // Encrypt tokens and upsert
    const encryptedAccess = encrypt(access_token);
    const encryptedRefresh = refresh_token ? encrypt(refresh_token) : encrypt('');

    await db('ravelry_tokens')
      .insert({
        user_id: userId,
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        token_type: token_type || 'Bearer',
        expires_at: expiresAt,
        scope: scope || null,
        ravelry_username: ravelryUsername,
        updated_at: db.fn.now(),
      })
      .onConflict('user_id')
      .merge({
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        token_type: token_type || 'Bearer',
        expires_at: expiresAt,
        scope: scope || null,
        ravelry_username: ravelryUsername,
        updated_at: db.fn.now(),
      });

    logger.info('Ravelry OAuth tokens stored', { userId, ravelryUsername });

    return { ravelryUsername };
  }

  async getValidTokenForUser(userId: string): Promise<string | null> {
    const row = await db('ravelry_tokens').where({ user_id: userId }).first();
    if (!row) return null;

    const now = new Date();
    const expiresAt = new Date(row.expires_at);

    // Check if token needs refresh
    if (expiresAt.getTime() - now.getTime() < TOKEN_REFRESH_BUFFER * 1000) {
      try {
        return await this.refreshTokenForUser(userId, row);
      } catch (error: any) {
        logger.error('Failed to refresh Ravelry token', { userId, error: error.message });
        // If refresh fails, delete the tokens so user re-authorizes
        await this.disconnectUser(userId);
        return null;
      }
    }

    return decrypt(row.access_token);
  }

  private async refreshTokenForUser(userId: string, row: any): Promise<string> {
    const { clientId, clientSecret } = this.getConfig();
    const refreshToken = decrypt(row.refresh_token);

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const tokenResponse = await axios.post(RAVELRY_TOKEN_URL, new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });

    const { access_token, refresh_token: newRefreshToken, expires_in } = tokenResponse.data;
    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

    const encryptedAccess = encrypt(access_token);
    const updateData: any = {
      access_token: encryptedAccess,
      expires_at: expiresAt,
      updated_at: db.fn.now(),
    };

    if (newRefreshToken) {
      updateData.refresh_token = encrypt(newRefreshToken);
    }

    await db('ravelry_tokens').where({ user_id: userId }).update(updateData);

    logger.info('Ravelry OAuth token refreshed', { userId });
    return access_token;
  }

  async disconnectUser(userId: string): Promise<void> {
    await db('ravelry_tokens').where({ user_id: userId }).delete();
    logger.info('Ravelry disconnected', { userId });
  }

  async isUserConnected(userId: string): Promise<boolean> {
    const row = await db('ravelry_tokens').where({ user_id: userId }).select('id').first();
    return !!row;
  }

  async getConnectionStatus(userId: string): Promise<{ connected: boolean; ravelryUsername: string | null }> {
    const row = await db('ravelry_tokens').where({ user_id: userId }).select('ravelry_username').first();
    return {
      connected: !!row,
      ravelryUsername: row?.ravelry_username || null,
    };
  }
}

export class InvalidOAuthStateError extends Error {
  constructor() {
    super('Invalid or expired OAuth state. Please try connecting again.');
    this.name = 'InvalidOAuthStateError';
  }
}

const ravelryOAuthService = new RavelryOAuthService();
export default ravelryOAuthService;
