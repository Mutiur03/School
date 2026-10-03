import './instrument.js';
import path from 'path';
import fs from 'fs';
import { env } from './config/env.js';
import logger from './utils/logger.js';
import { check } from './config/redis.js';
import { startMarksheetWorker, drainMarksheetQueue } from './modules/marks/marksheet.worker.js';
import {
  startAttendanceSheetWorker,
  drainAttendanceSheetQueue,
} from './modules/attendence/attendence-sheet.worker.js';
import generateToken from '@/utils/generateSetupToken.js';
import { createApp } from './app.js';

const app = await createApp();
const PORT = env.PORT || 5000;

generateToken();
const httpServer = app.listen(PORT, () => {
  const logsPath = path.resolve('logs');
  fs.mkdir(logsPath, { recursive: true }, (err) => {
    if (err) {
      logger.error('Error creating logs directory', { error: err.message });
    } else {
      logger.info('Logs directory ready', {
        path: logsPath,
      });
    }
  });
  const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  logger.info(`Server started`, {
    port: PORT,
    mode,
    health: `http://localhost:${PORT}/api/health`,
  });
  check();
  startMarksheetWorker();
  startAttendanceSheetWorker();
});

httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(
      `Port ${PORT} is already in use — stop the other process or run "pnpm clean:ports" from the repo root`,
    );
  } else {
    logger.error('HTTP server failed to start', { error: err.message, code: err.code });
  }
  process.exit(1);
});

let shuttingDown = false;
const gracefulShutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, draining marksheet + attendance-sheet workers…`);

  try {
    await Promise.all([drainMarksheetQueue(), drainAttendanceSheetQueue()]);
  } catch (e) {
    logger.warn('Queue drain error during shutdown', {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  await new Promise<void>((resolve) => {
    httpServer.close(() => {
      logger.info('HTTP server closed');
      resolve();
    });
  });

  process.exit(0);
};

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

export default app;
