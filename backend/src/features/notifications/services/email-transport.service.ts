import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import type { SendEmailOptions } from '../domain/types.js';

/**
 * Handles SMTP transport creation and email delivery via Nodemailer.
 * Verifies required SMTP environment variables before sending.
 */
@Injectable()
export class EmailTransportService {
  private readonly logger = new Logger(EmailTransportService.name);
  private transporterOverride?: Transporter;

  /** Allow test suites to inject an in-memory or mocked Nodemailer transporter. */
  setTransporterOverride(transporter?: Transporter): void {
    this.transporterOverride = transporter;
  }

  /** Send email via configured SMTP credentials or custom test transporter. */
  async send(options: SendEmailOptions): Promise<void> {
    const transport = this.transporterOverride ?? this.createTransport();
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

    if (!from) {
      throw new Error('EMAIL_FROM or SMTP_USER is required to send notification emails.');
    }

    await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    this.logger.log(`Digest email sent successfully to ${options.to}`);
  }

  private createTransport(): Transporter {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const from = process.env.EMAIL_FROM?.trim() || user;
    const port = Number(process.env.SMTP_PORT ?? 587);
    const secure = (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true';

    if (!host || !user || !pass || !from) {
      throw new Error(
        'SMTP_HOST, SMTP_USER, SMTP_PASS and EMAIL_FROM/SMTP_USER are required when email is enabled',
      );
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }
}
