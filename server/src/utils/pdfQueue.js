import Bull from "bull";
const host = process.env.REDIS_HOST || "127.0.0.1";
export const pdfQueue = new Bull("pdfQueue", {
  redis: { host, port: 6379 },
});
