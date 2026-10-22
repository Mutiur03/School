import * as Brevo from '@getbrevo/brevo';
import { env } from '@/config/env.js';
import logger from '@/utils/logger.js';
import { sendToMailpit } from '@/utils/mailpit.js';

interface Attachment {
  filename: string;
  content: Buffer;
}

class EmailService {
  static client: Brevo.TransactionalEmailsApi | null = null;

  /** When MAILPIT_URL is set, capture the message locally and skip Brevo. */
  private static async capture(message: {
    from?: string;
    to: string;
    subject: string;
    body: string;
    attachment?: Attachment;
  }): Promise<boolean | null> {
    if (!env.MAILPIT_URL) return null;
    const from = message.from || env.FROM_EMAIL;
    if (!from) {
      logger.error('Could not send email: FROM_EMAIL is not set.');
      return false;
    }
    const result = await sendToMailpit(env.MAILPIT_URL, { ...message, from });
    if (result.ok) logger.info(result.detail);
    else logger.error(result.detail);
    return result.ok;
  }

  static getClient(): Brevo.TransactionalEmailsApi | null {
    if (!this.client) {
      if (!env.BREVO_API_KEY) {
        logger.warn('Brevo API key not configured.');
        return null;
      }
      this.client = new Brevo.TransactionalEmailsApi();
      this.client.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, env.BREVO_API_KEY);
    }
    return this.client;
  }

  static async sendEmail({
    from,
    to,
    subject,
    body,
    retries = 3,
  }: {
    from?: string;
    to: string;
    subject: string;
    body: string;
    retries?: number;
  }): Promise<boolean> {
    const captured = await this.capture({ from, to, subject, body });
    if (captured !== null) return captured;

    const client = this.getClient();
    if (!client) {
      logger.error('Could not send email: Client not configured.');
      return false;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const sendSmtpEmail = new Brevo.SendSmtpEmail();
        sendSmtpEmail.sender = {
          email: from || env.FROM_EMAIL,
          name: 'School System',
        };
        sendSmtpEmail.to = [{ email: to }];
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.textContent = body;

        const data = await client.sendTransacEmail(sendSmtpEmail);

        logger.info(`Email sent: ${data.body.messageId}`);
        return true;
      } catch (error) {
        logger.error(`Error sending email (attempt ${attempt}/${retries}):`, error);

        if (attempt === retries) {
          logger.error('All email sending attempts failed');
          return false;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return false;
  }

  static async sendEmailWithAttachment({
    from,
    to,
    subject,
    body,
    attachment,
  }: {
    from?: string;
    to: string;
    subject: string;
    body: string;
    attachment: Attachment;
  }): Promise<boolean> {
    const captured = await this.capture({ from, to, subject, body, attachment });
    if (captured !== null) return captured;

    const client = this.getClient();
    if (!client) {
      logger.error('Could not send email: Client not configured.');
      return false;
    }

    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.sender = {
        email: from || env.FROM_EMAIL,
        name: 'School System',
      };
      sendSmtpEmail.to = [{ email: to }];
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.textContent = body;
      sendSmtpEmail.attachment = [
        {
          name: attachment.filename,
          content: attachment.content.toString('base64'),
        },
      ];

      const data = await client.sendTransacEmail(sendSmtpEmail);

      logger.info(`Email sent: ${data.body.messageId}`);
      return true;
    } catch (error) {
      logger.error('Error sending email with attachment:', error);
      return false;
    }
  }

  static async sendSetupTokenEmail(token: string, role: string): Promise<boolean> {
    const to = role === 'super_admin' ? 'mutiur5bb@gmail.com' : env.TO_EMAIL;
    if (!to) {
      logger.error('Could not send email: recipient is not set.');
      return false;
    }
    const captured = await this.capture({
      to,
      subject: 'Setup Token',
      body: `Setup Token: ${token} for ${role}. This token will expire in 15 minutes.`,
    });
    if (captured !== null) return captured;

    const client = this.getClient();
    if (!client) {
      logger.error('Could not send email: Client not configured.');
      return false;
    }

    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.sender = {
        email: env.FROM_EMAIL,
        name: 'School System',
      };
      sendSmtpEmail.to = [{ email: to }];
      sendSmtpEmail.subject = 'Setup Token';
      sendSmtpEmail.textContent = `Setup Token: ${token} for ${role}. This token will expire in 15 minutes.`;

      const data = await client.sendTransacEmail(sendSmtpEmail);

      logger.info(`Email sent: ${data.body.messageId}`);
      return true;
    } catch (error) {
      logger.error('Error sending email:', error);
      return false;
    }
  }

  static async sendSuperAdminSetupEmail(email: string, password: string): Promise<boolean> {
    const captured = await this.capture({
      to: 'mutiur5bb@gmail.com',
      subject: 'Super Admin Setup',
      body: `Super Admin Setup: Email: ${email}, Password: ${password}`,
    });
    if (captured !== null) return captured;

    const client = this.getClient();
    if (!client) {
      logger.error('Could not send email: Client not configured.');
      return false;
    }

    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.sender = {
        email: env.FROM_EMAIL,
        name: 'School System',
      };
      sendSmtpEmail.to = [{ email: 'mutiur5bb@gmail.com' }];
      sendSmtpEmail.subject = 'Super Admin Setup';
      sendSmtpEmail.textContent = `Super Admin Setup: Email: ${email}, Password: ${password}`;

      const data = await client.sendTransacEmail(sendSmtpEmail);

      logger.info(`Email sent: ${data.body.messageId}`);
      return true;
    } catch (error) {
      logger.error('Error sending super admin setup email:', error);
      return false;
    }
  }
}

export default EmailService;
