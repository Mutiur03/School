import * as Brevo from "@getbrevo/brevo";
import { env } from "../config/env.js";
import logger from "./logger.js";

class EmailService {
  static client = null;

  static getClient() {
    if (!this.client) {
      if (!env.BREVO_API_KEY) {
        logger.warn("Brevo API key not configured.");
        return null;
      }
      this.client = new Brevo.TransactionalEmailsApi();
      this.client.authentications["apiKey"].apiKey = env.BREVO_API_KEY;
    }
    return this.client;
  }

  static async sendEmail({ from, to, subject, body, retries = 3 }) {
    const client = this.getClient();
    if (!client) {
      logger.error("Could not send email: Client not configured.");
      return false;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const info = await client.sendTransacEmail({
          sender: {
            email: from || env.FROM_EMAIL,
            name: "School System",
          },
          to: [{ email: to }],
          subject,
          textContent: body,
        });

        logger.info(`Email sent: ${info.body.messageId}`);
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
  }

  static async sendEmailWithAttachment({
    from,
    to,
    subject,
    body,
    attachment,
  }) {
    const client = this.getClient();
    if (!client) {
      logger.error("Could not send email: Client not configured.");
      return false;
    }

    try {
      const info = await client.sendTransacEmail({
        sender: {
          email: from || env.FROM_EMAIL,
          name: "School System",
        },
        to: [{ email: to }],
        subject,
        textContent: body,
        attachment: [
          {
            name: attachment.filename,
            content: attachment.content.toString("base64"),
          },
        ],
      });

      logger.info(`Email sent: ${info.body.messageId}`);
      return true;
    } catch (error) {
      logger.error("Error sending email with attachment:", error);
      return false;
    }
  }

  static async sendSetupTokenEmail(token, role) {
    const client = this.getClient();
    if (!client) {
      logger.error("Could not send email: Client not configured.");
      return false;
    }

    try {
      const info = await client.sendTransacEmail({
        sender: {
          email: env.FROM_EMAIL,
          name: "School System",
        },
        to:
          role === "super_admin"
            ? [{ email: "mutiur5bb@gmail.com" }]
            : [{ email: env.TO_EMAIL }],
        subject: "Setup Token",
        textContent: `Setup Token: ${token} for ${role}. This token will expire in 1 hour.`,
      });

      logger.info(`Email sent: ${info.body.messageId}`);
      return true;
    } catch (error) {
      logger.error("Error sending email:", error);
      return false;
    }
  }

  static async sendSuperAdminSetupEmail(email, password) {
    const client = this.getClient();
    if (!client) {
      logger.error("Could not send email: Client not configured.");
      return false;
    }

    try {
      const info = await client.sendTransacEmail({
        sender: {
          email: env.FROM_EMAIL,
          name: "School System",
        },
        to: [{ email: "mutiur5bb@gmail.com" }],
        subject: "Super Admin Setup",
        textContent: `Super Admin Setup: Email: ${email}, Password: ${password}`,
      });

      logger.info(`Email sent: ${info.body.messageId}`);
      return true;
    } catch (error) {
      logger.error("Error sending super admin setup email:", error);
      return false;
    }
  }
}

export default EmailService;
