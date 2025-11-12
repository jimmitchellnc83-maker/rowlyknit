import nodemailer, { Transporter } from 'nodemailer';
import db from '../config/database';
import logger from '../config/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  template?: string;
}

class EmailService {
  private transporter: Transporter;

  constructor() {
    this.transporter = this.createTransporter();
  }

  private createTransporter(): Transporter {
    const provider = process.env.EMAIL_PROVIDER || 'sendgrid';

    if (provider === 'sendgrid') {
      return nodemailer.createTransporter({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: process.env.EMAIL_API_KEY,
        },
      });
    } else if (provider === 'postmark') {
      return nodemailer.createTransporter({
        host: 'smtp.postmarkapp.com',
        port: 587,
        auth: {
          user: process.env.EMAIL_API_KEY,
          pass: process.env.EMAIL_API_KEY,
        },
      });
    } else if (provider === 'ses') {
      return nodemailer.createTransporter({
        host: `email-smtp.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`,
        port: 587,
        auth: {
          user: process.env.AWS_SES_ACCESS_KEY,
          pass: process.env.AWS_SES_SECRET_KEY,
        },
      });
    } else {
      // Development mode - log emails to console
      return nodemailer.createTransporter({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      });
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const from = `${process.env.EMAIL_FROM_NAME || 'Rowly'} <${process.env.EMAIL_FROM || 'noreply@rowlyknit.com'}>`;

      const info = await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: process.env.EMAIL_REPLY_TO || 'support@rowlyknit.com',
      });

      // Log email
      await db('email_logs').insert({
        to_email: options.to,
        subject: options.subject,
        template: options.template || 'custom',
        status: 'sent',
        provider_id: info.messageId,
        sent_at: new Date(),
      });

      logger.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
        messageId: info.messageId,
      });
    } catch (error) {
      logger.error('Failed to send email', {
        to: options.to,
        subject: options.subject,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Log failed email
      await db('email_logs').insert({
        to_email: options.to,
        subject: options.subject,
        template: options.template || 'custom',
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        sent_at: new Date(),
      });

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
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
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
          <a href="${resetUrl}" class="button">Reset Password</a>
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
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
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
