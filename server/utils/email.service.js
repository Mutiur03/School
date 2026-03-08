import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import logger from "./logger.js";

class EmailService {
  static transporter = null;

  static getTransporter() {
    if (!this.transporter) {
      if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
        logger.warn(
          "SMTP credentials not fully configured. Email service will not work.",
        );
        return null;
      }

      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: parseInt(env.SMTP_PORT || "587"),
        secure: parseInt(env.SMTP_PORT || "587") === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
        connectionTimeout: 30000, // 30 seconds
        greetingTimeout: 15000,   // 15 seconds
        socketTimeout: 60000,     // 60 seconds
        pool: true,               // Enable connection pooling
        maxConnections: 5,        // Max concurrent connections
        maxMessages: 100,         // Messages per connection
        rateDelta: 1000,          // Rate limiting
        rateLimit: 5,             // Max 5 messages per second
      });
    }
    return this.transporter;
  }

  static async sendEmailWithAttachment({
    from,
    to,
    subject,
    body,
    attachment,
  }) {
    const transporter = this.getTransporter();
    if (!transporter) {
      logger.error("Could not send email: Transporter not configured.");
      return false;
    }

    try {
      const info = await transporter.sendMail({
        from: from || `"School System" <${env.SMTP_USER}>`,
        to,
        subject,
        text: body,
        attachments: [
          {
            filename: attachment.filename,
            content: attachment.content,
          },
        ],
      });

      logger.info(`Email sent: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error("Error sending email:", error);
      return false;
    }
  }

  static async sendEmail({ from, to, subject, body, retries = 3 }) {
    const transporter = this.getTransporter();
    if (!transporter) {
      logger.error("Could not send email: Transporter not configured.");
      return false;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const info = await transporter.sendMail({
          from: from || `"School System" <${env.SMTP_USER}>`,
          to,
          subject,
          text: body,
        });

        logger.info(`Email sent: ${info.messageId}`);
        return true;
      } catch (error) {
        logger.error(`Error sending email (attempt ${attempt}/${retries}):`, error);
        
        if (attempt === retries) {
          logger.error("All email sending attempts failed");
          return false;
        }
        
        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

export default EmailService;
