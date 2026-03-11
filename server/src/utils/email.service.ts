import * as Brevo from "@getbrevo/brevo";
import { env } from "@/config/env.js";
import logger from "@/utils/logger.js";

interface Attachment {
  filename: string;
  content: Buffer;
}

class EmailService {
  static client: Brevo.TransactionalEmailsApi | null = null;

  static getClient(): Brevo.TransactionalEmailsApi | null {
    if (!this.client) {
      if (!env.BREVO_API_KEY) {
        logger.warn("Brevo API key not configured.");
        return null;
      }
      this.client = new Brevo.TransactionalEmailsApi();
      this.client.setApiKey(
        Brevo.TransactionalEmailsApiApiKeys.apiKey,
        env.BREVO_API_KEY,
      );
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
    const client = this.getClient();
    if (!client) {
      logger.error("Could not send email: Client not configured.");
      return false;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const sendSmtpEmail = new Brevo.SendSmtpEmail();
        sendSmtpEmail.sender = {
          email: from || env.FROM_EMAIL,
          name: "School System",
        };
        sendSmtpEmail.to = [{ email: to }];
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.textContent = body;

        const data = await client.sendTransacEmail(sendSmtpEmail);

        logger.info(`Email sent: ${data.body.messageId}`);
        return true;
      } catch (error) {
        logger.error(
          `Error sending email (attempt ${attempt}/${retries}):`,
          error,
        );

        if (attempt === retries) {
          logger.error("All email sending attempts failed");
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
    const client = this.getClient();
    if (!client) {
      logger.error("Could not send email: Client not configured.");
      return false;
    }

    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.sender = {
        email: from || env.FROM_EMAIL,
        name: "School System",
      };
      sendSmtpEmail.to = [{ email: to }];
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.textContent = body;
      sendSmtpEmail.attachment = [
        {
          name: attachment.filename,
          content: attachment.content.toString("base64"),
        },
      ];

      const data = await client.sendTransacEmail(sendSmtpEmail);

      logger.info(`Email sent: ${data.body.messageId}`);
      return true;
    } catch (error) {
      logger.error("Error sending email with attachment:", error);
      return false;
    }
  }

  static async sendSetupTokenEmail(
    token: string,
    role: string,
  ): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      logger.error("Could not send email: Client not configured.");
      return false;
    }

    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.sender = {
        email: env.FROM_EMAIL,
        name: "School System",
      };
      sendSmtpEmail.to =
        role === "super_admin"
          ? [{ email: "mutiur5bb@gmail.com" }]
          : [{ email: env.TO_EMAIL as string }];
      sendSmtpEmail.subject = "Setup Token";
      sendSmtpEmail.textContent = `Setup Token: ${token} for ${role}. This token will expire in 15 minutes.`;

      const data = await client.sendTransacEmail(sendSmtpEmail);

      logger.info(`Email sent: ${data.body.messageId}`);
      return true;
    } catch (error) {
      logger.error("Error sending email:", error);
      return false;
    }
  }

  static async sendSuperAdminSetupEmail(
    email: string,
    password: string,
  ): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      logger.error("Could not send email: Client not configured.");
      return false;
    }

    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.sender = {
        email: env.FROM_EMAIL,
        name: "School System",
      };
      sendSmtpEmail.to = [{ email: "mutiur5bb@gmail.com" }];
      sendSmtpEmail.subject = "Super Admin Setup";
      sendSmtpEmail.textContent = `Super Admin Setup: Email: ${email}, Password: ${password}`;

      const data = await client.sendTransacEmail(sendSmtpEmail);

      logger.info(`Email sent: ${data.body.messageId}`);
      return true;
    } catch (error) {
      logger.error("Error sending super admin setup email:", error);
      return false;
    }
  }
}

export default EmailService;
