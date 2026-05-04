/**
 * Auth + Security Hardening Sprint — provider-agnostic email plumbing.
 *
 * Pins three contracts:
 *   1. The factory picks the right adapter by EMAIL_PROVIDER.
 *   2. Missing secrets degrade to no-op (in dev/test) without crash.
 *   3. The no-op adapter logs ONLY non-secret metadata — never the
 *      body, never a reset URL.
 */

const loggerWarn = jest.fn();
const loggerInfo = jest.fn();
const loggerError = jest.fn();

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: { warn: loggerWarn, info: loggerInfo, error: loggerError },
}));

jest.mock('axios', () => {
  const post = jest.fn();
  return {
    __esModule: true,
    default: { post },
    post, // some imports use bare `axios.post`
  };
});

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({
      sendMail: jest.fn().mockResolvedValue({ messageId: 'smtp-stub' }),
    })),
  },
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'smtp-stub' }),
  })),
}));

import { createEmailAdapter, __test__ } from '../emailAdapters';

const ENV_KEYS = [
  'EMAIL_PROVIDER',
  'EMAIL_API_KEY',
  'AWS_SES_ACCESS_KEY',
  'AWS_SES_SECRET_KEY',
  'AWS_REGION',
  'NODE_ENV',
] as const;

const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeAll(() => {
  for (const k of ENV_KEYS) originalEnv[k] = process.env[k];
});

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (originalEnv[k] === undefined) delete process.env[k];
    else process.env[k] = originalEnv[k] as string;
  }
});

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  jest.clearAllMocks();
});

describe('createEmailAdapter', () => {
  it('returns a Resend adapter when EMAIL_PROVIDER=resend and the key is set', () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.EMAIL_API_KEY = 'rk_test_xxx';
    const adapter = createEmailAdapter();
    expect(adapter.name).toBe('resend');
    expect(adapter).toBeInstanceOf(__test__.ResendAdapter);
  });

  it('falls back to no-op when provider=resend but EMAIL_API_KEY missing (dev)', () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.NODE_ENV = 'test';
    const adapter = createEmailAdapter();
    expect(adapter.name).toBe('noop');
  });

  it('falls back to no-op when provider=resend but EMAIL_API_KEY missing (prod logs a warning)', () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.NODE_ENV = 'production';
    const adapter = createEmailAdapter();
    expect(adapter.name).toBe('noop');
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('EMAIL_PROVIDER=resend'),
    );
  });

  it('returns a Postmark SMTP adapter for provider=postmark', () => {
    process.env.EMAIL_PROVIDER = 'postmark';
    process.env.EMAIL_API_KEY = 'postmark-server-token';
    const adapter = createEmailAdapter();
    expect(adapter.name).toBe('postmark');
    expect(adapter).toBeInstanceOf(__test__.NodemailerSmtpAdapter);
  });

  it('returns a SendGrid SMTP adapter when provider is unset (backwards-compat) and key present', () => {
    process.env.EMAIL_API_KEY = 'sg-key';
    const adapter = createEmailAdapter();
    expect(adapter.name).toBe('sendgrid');
  });

  it('falls back to no-op when sendgrid is the default and no key is set', () => {
    process.env.NODE_ENV = 'test';
    const adapter = createEmailAdapter();
    expect(adapter.name).toBe('noop');
  });

  it('returns the explicit no-op adapter when EMAIL_PROVIDER=noop', () => {
    process.env.EMAIL_PROVIDER = 'noop';
    const adapter = createEmailAdapter();
    expect(adapter.name).toBe('noop');
  });

  it('falls back to no-op for ses without AWS credentials', () => {
    process.env.EMAIL_PROVIDER = 'ses';
    const adapter = createEmailAdapter();
    expect(adapter.name).toBe('noop');
  });
});

describe('NoopAdapter logs only non-secret metadata', () => {
  it('does not include the email body or any URL in the log line', async () => {
    process.env.EMAIL_PROVIDER = 'noop';
    const adapter = createEmailAdapter();

    await adapter.send({
      from: 'noreply@rowlyknit.com',
      to: 'a@example.com',
      subject: 'Reset Your Rowly Password',
      html: '<a href="https://rowlyknit.com/reset-password?token=SECRET-RAW-TOKEN">click</a>',
      text: 'reset your password at https://rowlyknit.com/reset-password?token=SECRET-RAW-TOKEN',
      template: 'password_reset',
    });

    expect(loggerWarn).toHaveBeenCalledTimes(1);
    const [, payload] = (loggerWarn as jest.Mock).mock.calls[0];
    expect(payload).toEqual({
      to: 'a@example.com',
      subject: 'Reset Your Rowly Password',
      template: 'password_reset',
    });
    // Bodies and URLs must not show up anywhere in the log payload.
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/SECRET-RAW-TOKEN/);
    expect(serialized).not.toMatch(/<a /);
  });
});

describe('ResendAdapter sends through the HTTP API', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const axios = require('axios');

  it('POSTs to /emails with Bearer auth and returns the resend id', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.EMAIL_API_KEY = 'rk_test_xxx';
    const adapter = createEmailAdapter();
    axios.default.post.mockResolvedValueOnce({ data: { id: 'msg_123' } });

    const result = await adapter.send({
      from: 'Rowly <noreply@rowlyknit.com>',
      to: 'a@example.com',
      subject: 'hi',
      html: '<p>hi</p>',
      replyTo: 'support@rowlyknit.com',
    });

    expect(result).toEqual({ id: 'msg_123', adapter: 'resend' });
    expect(axios.default.post).toHaveBeenCalledTimes(1);
    const [url, body, options] = axios.default.post.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(body).toEqual({
      from: 'Rowly <noreply@rowlyknit.com>',
      to: 'a@example.com',
      subject: 'hi',
      html: '<p>hi</p>',
      reply_to: 'support@rowlyknit.com',
    });
    expect(options.headers.Authorization).toBe('Bearer rk_test_xxx');
  });
});
