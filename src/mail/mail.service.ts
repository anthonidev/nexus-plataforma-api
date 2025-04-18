import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { envs } from 'src/config/envs';

interface SendMailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly defaultFromEmail = 'no-reply@nexushglobal.com';

  constructor() {
    this.resend = new Resend(envs.resendApiKey);
  }

  async sendMail(options: SendMailOptions) {
    try {
      const { to, subject, html, text, from = this.defaultFromEmail } = options;

      if (!html && !text) {
        throw new Error('Either html or text content must be provided');
      }

      const recipients = Array.isArray(to) ? to : [to];

      const response = await this.resend.emails.send({
        from,
        to: recipients,
        subject,
        html: html || undefined,
        text: !html ? text : undefined,
      });

      this.logger.log(`Email sent to ${recipients.join(', ')}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw error;
    }
  }
}
