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

/**
 * Gmail (and several mobile clients) strip <style> blocks that use class
 * selectors before rendering, leaving the <a class="button"> with no
 * declared color and the link text inheriting the client's default link
 * color — which on a saturated background reads as invisible / barely
 * legible. Bug observed live on Resend smoke 2026-05-05: "Reset Password"
 * and "Verify Email Address" buttons rendered with their fill but no
 * readable label.
 *
 * Fix is to inline the critical button styles directly on each <a>.
 * These tests pin "every templated CTA button has its color inlined"
 * so a future template tweak can't silently regress the same way.
 */
describe('email template buttons — inline styles survive Gmail <style> stripping', () => {
  const captureSentHtml = async (
    runner: () => Promise<void>,
  ): Promise<string> => {
    let captured = '';
    adapterStub.send = jest.fn().mockImplementation(async (payload: { html: string }) => {
      captured = payload.html;
      return { id: 'capture', adapter: 'resend' };
    });
    await runner();
    return captured;
  };

  const assertInlinedButton = (html: string, expectedBg: string) => {
    // Every templated CTA is rendered as <a class="button" style="...">.
    // The inline style MUST set the text color (Gmail strips the
    // class-selector color rule) AND must keep display:inline-block so
    // padding renders.
    const buttonAnchorRegex =
      /<a [^>]*class="button"[^>]*style="([^"]*)"[^>]*>/g;
    const matches = [...html.matchAll(buttonAnchorRegex)];
    expect(matches.length).toBeGreaterThan(0);
    for (const [, styleAttr] of matches) {
      expect(styleAttr).toMatch(/color:\s*#ffffff/i);
      expect(styleAttr).toMatch(/display:\s*inline-block/i);
      expect(styleAttr).toMatch(new RegExp(`background-color:\\s*${expectedBg}`, 'i'));
    }
  };

  it('welcome email: button has color:#ffffff inlined on the indigo bg', async () => {
    const html = await captureSentHtml(() =>
      emailService.sendWelcomeEmail('a@example.com', 'A', 'https://rowlyknit.com/verify?t=x'),
    );
    assertInlinedButton(html, '#4F46E5');
  });

  it('password reset email: button has color:#ffffff inlined on the indigo bg', async () => {
    const html = await captureSentHtml(() =>
      emailService.sendPasswordResetEmail('a@example.com', 'A', 'https://rowlyknit.com/reset?t=x'),
    );
    assertInlinedButton(html, '#4F46E5');
  });

  it('account deletion email: button has color:#ffffff inlined on the red bg', async () => {
    const html = await captureSentHtml(() =>
      emailService.sendAccountDeletionConfirmEmail(
        'a@example.com',
        'A',
        'https://rowlyknit.com/delete?t=x',
        14,
      ),
    );
    assertInlinedButton(html, '#DC2626');
  });

  it('verification (resend) email: button has color:#ffffff inlined on the indigo bg', async () => {
    const html = await captureSentHtml(() =>
      emailService.sendVerificationEmail('a@example.com', 'A', 'https://rowlyknit.com/verify?t=x'),
    );
    assertInlinedButton(html, '#4F46E5');
  });
});

/**
 * PR #384/#385 follow-up — finding #3.
 *
 * `firstName` / `name` is user-controlled (set at register) and gets
 * interpolated into HTML email bodies. Pre-fix that was raw `${name}`
 * concatenation, so a name like `<script>alert(1)</script>` or
 * `"><img src=x onerror=alert(1)>` would render in the recipient's
 * mail client. Fix is the shared `escapeHtml` helper applied to every
 * user-influenceable interpolation in every templated send.
 *
 * These tests pin "every templated email escapes name + URL." A
 * future template tweak can't accidentally drop the helper without
 * tripping a test.
 */
describe('email templates — user-controlled inputs are HTML-escaped', () => {
  // Reuses the module-level `adapterStub` from the file's setup
  // section. `beforeEach` clears it; we re-stub `.send` per call.
  const captureSentHtml = async (
    runner: () => Promise<void>,
  ): Promise<string> => {
    let captured = '';
    adapterStub.send = jest.fn().mockImplementation(async (payload: { html: string }) => {
      captured = payload.html;
      return { id: 'capture', adapter: 'resend' };
    });
    await runner();
    return captured;
  };

  // Three names, each exercising a different attack class:
  //   - `<script>` is the textbook XSS payload
  //   - `"><img onerror>` is the attribute-breakout via double-quote
  //   - `O'Brien` is the realistic-name single-quote case
  const HOSTILE_NAMES = [
    {
      label: 'angle brackets',
      raw: '<script>alert(1)</script>',
      escaped: '&lt;script&gt;alert(1)&lt;/script&gt;',
    },
    {
      label: 'attribute breakout',
      raw: '"><img src=x onerror=alert(1)>',
      escaped: '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;',
    },
    {
      label: 'apostrophe (realistic name)',
      raw: "O'Brien",
      escaped: 'O&#39;Brien',
    },
  ];

  const assertEscaped = (html: string, raw: string, escaped: string) => {
    // The escaped form must appear in the output.
    expect(html).toContain(escaped);
    // The raw, unescaped string must NOT appear anywhere — no
    // unescaped `<script>` even in a comment.
    expect(html).not.toContain(raw);
  };

  for (const { label, raw, escaped } of HOSTILE_NAMES) {
    it(`welcome email escapes name (${label})`, async () => {
      const html = await captureSentHtml(() =>
        emailService.sendWelcomeEmail(
          'x@example.com',
          raw,
          'https://rowlyknit.com/verify?t=x',
        ),
      );
      assertEscaped(html, raw, escaped);
    });

    it(`password reset email escapes name (${label})`, async () => {
      const html = await captureSentHtml(() =>
        emailService.sendPasswordResetEmail(
          'x@example.com',
          raw,
          'https://rowlyknit.com/reset?t=x',
        ),
      );
      assertEscaped(html, raw, escaped);
    });

    it(`account deletion email escapes name (${label})`, async () => {
      const html = await captureSentHtml(() =>
        emailService.sendAccountDeletionConfirmEmail(
          'x@example.com',
          raw,
          'https://rowlyknit.com/delete?t=x',
          14,
        ),
      );
      assertEscaped(html, raw, escaped);
    });

    it(`verification email escapes name (${label})`, async () => {
      const html = await captureSentHtml(() =>
        emailService.sendVerificationEmail(
          'x@example.com',
          raw,
          'https://rowlyknit.com/verify?t=x',
        ),
      );
      assertEscaped(html, raw, escaped);
    });
  }

  it('escapes URLs that contain & in query strings (smoke test for token URLs)', async () => {
    // Real reset URLs carry tokens; a query string with `&` must
    // become `&amp;` so the rendered HTML is valid AND so an attacker
    // who somehow gets the URL building piece can't inject through it.
    const html = await captureSentHtml(() =>
      emailService.sendPasswordResetEmail(
        'x@example.com',
        'A',
        'https://rowlyknit.com/reset?t=x&u=y',
      ),
    );
    expect(html).toContain('https://rowlyknit.com/reset?t=x&amp;u=y');
    expect(html).not.toContain('reset?t=x&u=y"'); // the raw `&` followed by quote
  });
});
