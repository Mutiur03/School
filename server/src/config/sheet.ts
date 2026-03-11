import { google } from "googleapis";
import { env } from "@/config/env.js";

export const initGoogleSheets = async () => {
  try {
    const requiredEnvVars = {
      client_email: process.env.client_email,
      private_key: process.env.private_key,
      SHEET_ID: process.env.SHEET_ID,
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([_key, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(", ")}`,
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: env.client_email,
        private_key: env.private_key?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = env.SHEET_ID;
    return { sheets, spreadsheetId };
  } catch (error: any) {
    throw new Error(
      `Google Sheets API initialization failed: ${error.message}`,
      { cause: error },
    );
  }
};

const { sheets, spreadsheetId } = await initGoogleSheets();

export { sheets, spreadsheetId };
