import axios from 'axios';
import fs from 'fs';
import path from 'path';
import logger from '../config/logger';

class TranscriptionService {
  async transcribeFromFile(
    filePath: string,
    contentType: string = 'audio/webm'
  ): Promise<string | null> {
    const webhookUrl = process.env.TRANSCRIPTION_WEBHOOK_URL;
    if (!webhookUrl) {
      logger.info('Transcription webhook not configured; skipping auto-transcription');
      return null;
    }

    try {
      const buffer = await fs.promises.readFile(filePath);
      const payload = {
        filename: path.basename(filePath),
        contentType,
        data: buffer.toString('base64'),
      };

      const response = await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.TRANSCRIPTION_API_KEY
            ? { 'x-api-key': process.env.TRANSCRIPTION_API_KEY }
            : {}),
        },
        timeout: 15000,
      });

      const transcription =
        response.data?.transcription || response.data?.text || response.data?.transcript || null;

      if (!transcription) {
        logger.warn('Transcription webhook returned no transcript', { filePath });
      }

      return transcription;
    } catch (error) {
      logger.error('Failed to auto-transcribe audio note', {
        filePath,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }
}

export default new TranscriptionService();
