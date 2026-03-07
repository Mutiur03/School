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
}

export default EmailService;
