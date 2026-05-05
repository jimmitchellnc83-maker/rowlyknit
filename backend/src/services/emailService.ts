import db from '../config/database';
import logger from '../config/logger';
import { createEmailAdapter, EmailAdapter } from './emailAdapters';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  template?: string;
}

/**
 * Provider-agnostic transactional email gateway. The actual SMTP/HTTP
 * mechanics live in `emailAdapters.ts`; this service handles the
 * cross-provider concerns: from-address composition, audit logging,
 * and the dev/test failure swallow. Add new providers in
 * `createEmailAdapter` — never branch on EMAIL_PROVIDER here.
 *
 * Env knobs (see `.env.example` for full docs):
 *   EMAIL_PROVIDER      — resend | postmark | sendgrid | ses | noop
 *   EMAIL_API_KEY       — provider key / token
 *   FROM_EMAIL          — preferred. Falls back to legacy EMAIL_FROM.
 *   EMAIL_FROM_NAME     — display name (defaults to "Rowly")
 *   EMAIL_REPLY_TO      — optional Reply-To header
 *   APP_URL             — base URL used in templated reset / verify links
 */
class EmailService {
  private adapter: EmailAdapter;

  constructor() {
    this.adapter = createEmailAdapter();
    logger.info(`[email] adapter initialized: ${this.adapter.name}`);
  }

  /** Visible to tests / ops only — production code paths use the typed senders below. */
  getAdapterName(): string {
    return this.adapter.name;
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    const fromAddress =
      process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@rowlyknit.com';
    const from = `${process.env.EMAIL_FROM_NAME || 'Rowly'} <${fromAddress}>`;
    const replyTo = process.env.EMAIL_REPLY_TO || 'support@rowlyknit.com';

    try {
      const info = await this.adapter.send({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo,
        template: options.template,
      });

      // The no-op adapter never touches a real provider — recording it as
      // 'sent' would let production silently appear to deliver mail when
      // it didn't. Mark these rows as 'skipped' so audit + reporting can
      // distinguish real provider delivery from log-only no-ops.
      const isNoop = info.adapter === 'noop';
      await db('email_logs').insert({
        to_email: options.to,
        subject: options.subject,
        template: options.template || 'custom',
        status: isNoop ? 'skipped' : 'sent',
        provider_id: info.id,
        sent_at: new Date(),
      });

      logger.info(
        isNoop ? 'Email send skipped (no-op adapter)' : 'Email sent successfully',
        {
          to: options.to,
          subject: options.subject,
          messageId: info.id,
          adapter: info.adapter,
        },
      );
    } catch (error) {
      logger.error('Failed to send email', {
        to: options.to,
        subject: options.subject,
        adapter: this.adapter.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await db('email_logs').insert({
        to_email: options.to,
        subject: options.subject,
        template: options.template || 'custom',
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        sent_at: new Date(),
      });

      // Don't fail the request in development — the call sites that
      // depend on transactional email (register, password reset) all
      // already log + persist the underlying token, so a degraded
      // outbound is recoverable. In production we still throw so
      // monitoring picks it up.
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Email sending skipped in development (no valid email provider configured)');
        return;
      }
      throw error;
    }
  }

  async sendWelcomeEmail(to: string, name: string, verificationUrl: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Welcome to Rowly! 🧶</h1>
          <p>Hi ${name},</p>
          <p>Thank you for joining Rowly, your complete knitting project management app!</p>
          <p>To get started, please verify your email address:</p>
          <a href="${verificationUrl}" class="button" style="display:inline-block;padding:12px 24px;background-color:#4F46E5;color:#ffffff;text-decoration:none;border-radius:6px;margin:20px 0;font-family:Arial,sans-serif;font-weight:600;font-size:16px;">Verify Email Address</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${verificationUrl}</p>
          <p>Once verified, you'll be able to:</p>
          <ul>
            <li>Track multiple knitting projects</li>
            <li>Manage your yarn stash</li>
            <li>Store and organize patterns</li>
            <li>Use project counters</li>
            <li>And much more!</li>
          </ul>
          <div class="footer">
            <p>If you didn't create this account, please ignore this email.</p>
            <p>&copy; ${new Date().getFullYear()} Rowly. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to,
      subject: 'Welcome to Rowly - Verify Your Email',
      html,
      template: 'welcome',
    });
  }

  async sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .warning { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px; margin: 20px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Password Reset Request</h1>
          <p>Hi ${name},</p>
          <p>We received a request to reset your password for your Rowly account.</p>
          <a href="${resetUrl}" class="button" style="display:inline-block;padding:12px 24px;background-color:#4F46E5;color:#ffffff;text-decoration:none;border-radius:6px;margin:20px 0;font-family:Arial,sans-serif;font-weight:600;font-size:16px;">Reset Password</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${resetUrl}</p>
          <div class="warning">
            <strong>Security Notice:</strong> This link will expire in 1 hour for security reasons.
          </div>
          <p>If you didn't request this password reset, please ignore this email and your password will remain unchanged.</p>
          <div class="footer">
            <p>For security, never share this email with anyone.</p>
            <p>&copy; ${new Date().getFullYear()} Rowly. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to,
      subject: 'Reset Your Rowly Password',
      html,
      template: 'password_reset',
    });
  }

  async sendAccountDeletionConfirmEmail(
    to: string,
    name: string,
    confirmUrl: string,
    graceDays: number,
  ): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #DC2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .warning { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px; margin: 20px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Confirm Account Deletion</h1>
          <p>Hi ${name},</p>
          <p>We received a request to delete your Rowly account. Click the button below to confirm. After you confirm, your account will be permanently deleted in <strong>${graceDays} days</strong>.</p>
          <a href="${confirmUrl}" class="button" style="display:inline-block;padding:12px 24px;background-color:#DC2626;color:#ffffff;text-decoration:none;border-radius:6px;margin:20px 0;font-family:Arial,sans-serif;font-weight:600;font-size:16px;">Confirm Deletion</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${confirmUrl}</p>
          <div class="warning">
            <strong>Change your mind?</strong> You can cancel the deletion any time during the ${graceDays}-day grace period from your Profile page. After ${graceDays} days, all your projects, patterns, yarn, and other data will be permanently removed and cannot be recovered.
          </div>
          <p>If you didn't request this, please ignore this email — no action will be taken.</p>
          <div class="footer">
            <p>For your security, never share this email with anyone.</p>
            <p>&copy; ${new Date().getFullYear()} Rowly. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to,
      subject: 'Confirm your Rowly account deletion',
      html,
      template: 'account_deletion_confirm',
    });
  }

  async sendVerificationEmail(to: string, name: string, verificationUrl: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Verify Your Email</h1>
          <p>Hi ${name},</p>
          <p>Please verify your email address to continue using Rowly:</p>
          <a href="${verificationUrl}" class="button" style="display:inline-block;padding:12px 24px;background-color:#4F46E5;color:#ffffff;text-decoration:none;border-radius:6px;margin:20px 0;font-family:Arial,sans-serif;font-weight:600;font-size:16px;">Verify Email Address</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${verificationUrl}</p>
          <div class="footer">
            <p>If you didn't request this verification, please ignore this email.</p>
            <p>&copy; ${new Date().getFullYear()} Rowly. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to,
      subject: 'Verify Your Email - Rowly',
      html,
      template: 'email_verification',
    });
  }
}

export default new EmailService();
