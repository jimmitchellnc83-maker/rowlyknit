import fs from 'fs';
import os from 'os';
import path from 'path';
import express, { Request, Response } from 'express';
import {
  generateStorageFilename,
  isSafeStorageFilename,
  streamSafeUpload,
} from '../uploadStorage';

// Tests target the storage helpers that replaced the unauthenticated
// `/uploads` static mount on 2026-05-02. The on-disk filename regex
// is the load-bearing invariant — nothing past it should pass through
// the streaming endpoint without a controller-level ownership check.

describe('uploadStorage', () => {
  describe('generateStorageFilename', () => {
    it('emits a 32-hex token + sanitized extension', () => {
      const fn = generateStorageFilename('.WEBP');
      expect(fn).toMatch(/^[a-f0-9]{32}\.webp$/);
    });

    it('strips path traversal characters from the extension', () => {
      const fn = generateStorageFilename('../sneaky');
      expect(fn).not.toContain('..');
      expect(fn).not.toContain('/');
      expect(fn).toMatch(/^[a-f0-9]{32}/);
    });

    it('returns just the hex token when extension is empty', () => {
      const fn = generateStorageFilename('');
      expect(fn).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('isSafeStorageFilename', () => {
    it('accepts the format we generate', () => {
      expect(isSafeStorageFilename('a'.repeat(32) + '.webp')).toBe(true);
      expect(isSafeStorageFilename('a'.repeat(32))).toBe(true);
    });

    it('rejects path traversal', () => {
      expect(isSafeStorageFilename('../../../etc/passwd')).toBe(false);
      expect(isSafeStorageFilename('a/b.webp')).toBe(false);
      expect(isSafeStorageFilename('a..b.webp')).toBe(false);
    });

    it('rejects legacy guessable filenames', () => {
      expect(isSafeStorageFilename('pattern-uuid-1234.pdf')).toBe(false);
      expect(isSafeStorageFilename('audio-uuid-1234.webm')).toBe(false);
    });
  });
});

describe('streamSafeUpload', () => {
  let tmpDir: string;
  let originalUploadDir: string | undefined;

  beforeAll(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'rowly-uploads-'));
    await fs.promises.mkdir(path.join(tmpDir, 'projects'), { recursive: true });
    originalUploadDir = process.env.UPLOAD_DIR;
    process.env.UPLOAD_DIR = tmpDir;
  });

  afterAll(async () => {
    if (originalUploadDir === undefined) {
      delete process.env.UPLOAD_DIR;
    } else {
      process.env.UPLOAD_DIR = originalUploadDir;
    }
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  // streamSafeUpload uses fs.createReadStream(...).pipe(res), so we need
  // a real Writable. Spin up a throwaway express server and round-trip
  // the request through HTTP so the streaming + status paths get exercised.
  async function callStreamer(opts: {
    subdir: string;
    filename: string;
    fileBytes?: Buffer;
  }): Promise<{ status: number; body: Buffer; headers: Record<string, string> }> {
    if (opts.fileBytes) {
      const filePath = path.join(tmpDir, opts.subdir, opts.filename);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, opts.fileBytes);
    }
    const app = express();
    app.get('/probe', async (req: Request, res: Response) => {
      await streamSafeUpload(res, {
        subdir: opts.subdir,
        filename: opts.filename,
        mimeType: 'image/webp',
      });
    });
    const http = await import('http');
    return new Promise((resolve, reject) => {
      const server = app.listen(0, () => {
        const port = (server.address() as any).port;
        http
          .get(`http://127.0.0.1:${port}/probe`, (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (c) => chunks.push(Buffer.from(c)));
            res.on('end', () => {
              server.close();
              resolve({
                status: res.statusCode ?? 0,
                body: Buffer.concat(chunks),
                headers: res.headers as Record<string, string>,
              });
            });
            res.on('error', (err) => {
              server.close();
              reject(err);
            });
          })
          .on('error', (err) => {
            server.close();
            reject(err);
          });
      });
    });
  }

  it('streams the file when the filename is well-formed', async () => {
    const filename = 'a'.repeat(32) + '.webp';
    const bytes = Buffer.from('hello-world');
    const r = await callStreamer({ subdir: 'projects', filename, fileBytes: bytes });
    expect(r.status).toBe(200);
    expect(r.body.toString()).toBe('hello-world');
    expect(r.headers['content-type']).toContain('image/webp');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });

  it('returns 404 for path-traversal attempts', async () => {
    const r = await callStreamer({
      subdir: 'projects',
      filename: '../../etc/passwd',
    });
    expect(r.status).toBe(404);
  });

  it('returns 404 for legacy guessable filenames', async () => {
    const filename = 'pattern-uuid-1234.pdf';
    const r = await callStreamer({
      subdir: 'projects',
      filename,
      fileBytes: Buffer.from('legacy'),
    });
    expect(r.status).toBe(404);
  });

  it('returns 404 when the random name has no on-disk file', async () => {
    const r = await callStreamer({
      subdir: 'projects',
      filename: 'b'.repeat(32) + '.webp',
    });
    expect(r.status).toBe(404);
  });
});
