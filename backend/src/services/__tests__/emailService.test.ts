/**
 * EmailService — log-status contract.
 *
 * The PR #379 review finding was that no-op sends were recorded in
 * `email_logs` with status='sent', so production would silently look
 * like it had delivered transactional email when no provider was
 * configured. This suite pins the corrected contract:
 *
 *   - real provider delivery → status='sent', provider_id present
 *   - no-op delivery        → status='skipped', no provider_id semantics
 *
 * The adapter factory itself is covered in emailAdapters.test.ts; here
 * we inject adapters directly so we're testing the service layer.
 */

const insertSpy = jest.fn().mockResolvedValue([{ id: 'row-1' }]);
const dbFn: any = jest.fn(() => ({ insert: insertSpy }));

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: dbFn,
}));

const loggerWarn = jest.fn();
const loggerInfo = jest.fn();
const loggerError = jest.fn();

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: { warn: loggerWarn, info: loggerInfo, error: loggerError },
}));

// Avoid the singleton's adapter construction running production guards
// during this test file's NODE_ENV state.
const adapterStub = { name: 'noop', send: jest.fn() };
const createEmailAdapterMock = jest.fn(() => adapterStub);

jest.mock('../emailAdapters', () => ({
  __esModule: true,
  createEmailAdapter: createEmailAdapterMock,
}));

import emailService from '../emailService';

beforeEach(() => {
  jest.clearAllMocks();
  // Reset the stub between tests; individual cases set `.send` explicitly.
  adapterStub.send = jest.fn();
});

describe('EmailService.sendEmail — log status reflects real vs no-op delivery', () => {
  it("records status='sent' and provider_id when a real adapter delivers the message", async () => {
    adapterStub.send = jest
      .fn()
      .mockResolvedValue({ id: 'msg-resend-123', adapter: 'resend' });

    await emailService.sendEmail({
      to: 'a@example.com',
      subject: 'hi',
      html: '<p>hi</p>',
      template: 'welcome',
    });

    expect(dbFn).toHaveBeenCalledWith('email_logs');
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const [row] = insertSpy.mock.calls[0];
    expect(row.status).toBe('sent');
    expect(row.provider_id).toBe('msg-resend-123');
    expect(row.template).toBe('welcome');
    expect(loggerInfo).toHaveBeenCalledWith(
      'Email sent successfully',
      expect.objectContaining({ adapter: 'resend' }),
    );
  });

  it("records status='skipped' (NOT 'sent') when the no-op adapter handles the call", async () => {
    adapterStub.send = jest.fn().mockResolvedValue({ adapter: 'noop' });

    await emailService.sendEmail({
      to: 'b@example.com',
      subject: 'reset',
      html: '<a href="https://rowlyknit.com/reset?token=xxx">link</a>',
      template: 'password_reset',
    });

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const [row] = insertSpy.mock.calls[0];
    expect(row.status).toBe('skipped');
    expect(row.status).not.toBe('sent');
    expect(row.provider_id).toBeUndefined();
    expect(row.template).toBe('password_reset');
    expect(loggerInfo).toHaveBeenCalledWith(
      'Email send skipped (no-op adapter)',
      expect.objectContaining({ adapter: 'noop' }),
    );
  });

  it("records status='failed' (and re-throws in non-dev) when the adapter throws", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    adapterStub.send = jest.fn().mockRejectedValue(new Error('SMTP unreachable'));

    await expect(
      emailService.sendEmail({
        to: 'c@example.com',
        subject: 'verify',
        html: '<p>verify</p>',
        template: 'email_verification',
      }),
    ).rejects.toThrow('SMTP unreachable');

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const [row] = insertSpy.mock.calls[0];
    expect(row.status).toBe('failed');
    expect(row.error_message).toBe('SMTP unreachable');

    process.env.NODE_ENV = previousNodeEnv;
  });
});
