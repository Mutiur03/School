import express from 'express';
import 'dotenv/config';
import { env } from './config/env.js';

process.env.TZ = 'Asia/Dhaka';
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
import cors from 'cors';
import compression from 'compression';
import { detailedRequestLogger } from './middlewares/requestLogger.js';
import logger from './utils/logger.js';
import { createNest } from './nest/bootstrap.js';
import examRouter from './modules/exam/exam.route.js';
import { superAdminExamTypeRouter, tenantExamTypeRouter } from './modules/exam/exam-type.route.js';
import marksRouter from './modules/marks/marks.route.js';
import promotionRouter from './modules/promotion/promotion.route.js';
import {
  sharedAuthSessionRouter,
  superAdminAuthRouter,
  tenantAuthRouter,
} from './modules/auth/auth.route.js';
import cookieParser from 'cookie-parser';
import levelRouter from './modules/level/level.route.js';
import attendenceRouter from './modules/attendence/attendence.route.js';
import smsSettingsRoute from './modules/sms-settings/sms-settings.route.js';
import noticeRouter from './modules/notice/notice.route.js';
import eventsRouter from './modules/events/events.route.js';
import galleryRouter from './modules/gallery/gallery.route.js';
import dashboardRouter from './modules/dashboard/dashboard.route.js';
import syllabusRouter from './modules/syllabus/syllabus.route.js';
import classRoutineRouter from './modules/class-routine/class-routine.route.js';
import citizenCharterRouter from './modules/citizen-charter/citizen-charter.route.js';
import staffRouter from './modules/staff/staff.route.js';
import admissionRouter from './modules/admission/admission.route.js';
import admissionFormRouter from './modules/admission/form/admission-form.route.js';
import admissionResultRouter from './modules/admission/result/admission-result.route.js';
import smsRouter from './modules/sms-logs/sms-logs.route.js';
import registrationFormClass6Router from './modules/registration/class-6/Form/registrationFormClass6.route.js';
import registrationFormClass8Router from './modules/registration/class-8/Form/registrationFormClass8.route.js';
import registrationFormJuniorScholarshipRouter from './modules/registration/junior-scholarship/Form/registrationFormJuniorScholarship.route.js';
import registrationFormClass9Router from './modules/registration/class-9/Form/registrationFormClass9.route.js';
import {
  registrationSettingsClass6Router,
  registrationSettingsClass8Router,
  registrationSettingsJuniorScholarshipRouter,
  registrationSettingsClass9Router,
} from './modules/registration/registrationSettings.route.js';
import rateLimit from 'express-rate-limit';
import { MemoryStore } from 'express-rate-limit';
import AuthMiddleware from './middlewares/auth.middleware.js';
import { superAdminSchoolRouter, tenantSchoolRouter } from './modules/school/school.route.js';
import studentRouter from './modules/student/student.route.js';
import routerTeacher from './modules/teacher/teacher.route.js';
import subjectRouter from './modules/result/subject/subject.route.js';
import { schoolContextMiddleware, isKnownTenantHost } from './middlewares/tenant.middleware.js';
import { requireSchoolContextMiddleware } from './middlewares/access.middleware.js';
import {
  initRlsContextMiddleware,
  syncRlsSchoolContextMiddleware,
} from './middlewares/rlsContext.middleware.js';
import { getDatabasePoolStats } from './utils/dbMetrics.js';
import { enforceSubscriptionAccess } from './middlewares/subscription-access.middleware.js';

const app = express();

/** Behind nginx-proxy / load balancer in production — required for rate-limit IP keys. */
const resolveTrustProxy = (): boolean | number => {
  const raw = env.TRUST_PROXY?.trim().toLowerCase();
  if (raw === 'false' || raw === '0') return false;
  if (raw === 'true') return true;
  if (raw && /^\d+$/.test(raw)) return Number(raw);
  return env.NODE_ENV === 'production' ? 1 : false;
};
app.set('trust proxy', resolveTrustProxy());
const configuredOrigins = (env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim().toLowerCase())
  .filter(Boolean);

const isAllowedOrigin = async (origin?: string): Promise<boolean> => {
  if (!origin) return true;

  try {
    const hostname = new URL(origin).hostname.toLowerCase();

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')) {
      return true;
    }

    if (
      hostname === 'mutiurrahman.com' ||
      hostname.endsWith('.mutiurrahman.com') ||
      configuredOrigins.includes(origin.toLowerCase()) ||
      configuredOrigins.includes(hostname)
    ) {
      return true;
    }

    // Any school's registered customDomain — looked up (and cached) rather than
    // hardcoded, since there can be thousands of these and they change over time.
    return await isKnownTenantHost(hostname);
  } catch {
    return false;
  }
};

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    isAllowedOrigin(origin)
      .then((allowed) => {
        if (allowed) {
          callback(null, true);
          return;
        }
        callback(new Error('CORS blocked for this origin'));
      })
      .catch((error) => callback(error));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-host', 'x-forwarded-host'],
  exposedHeaders: ['X-Students-Created', 'X-Students-Requested'],
};

app.use(cors(corsOptions));
app.use(compression());
app.get('/api/health', async (_req, res) => {
  let database:
    | Awaited<ReturnType<typeof getDatabasePoolStats>>
    | {
        status: 'unavailable';
        error: string;
      };

  try {
    database = await getDatabasePoolStats();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database check failed';
    logger.warn('Health check database stats unavailable', { error: message });
    database = { status: 'unavailable', error: message };
  }

  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    database,
  });
});
app.use(detailedRequestLogger);
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(initRlsContextMiddleware);
const limitStore = new MemoryStore();
const LimitReq = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 5000 : 1000,
  message: {
    message: 'Too many requests, please try again after an hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: limitStore,
  skip: (req) => {
    const url = req.originalUrl || req.url;
    return (
      url.includes('/api/sms-settings/public') ||
      url.includes('/api/health') ||
      url.includes('/api/marks/generation-status')
    );
  },
});
app.use(LimitReq);
app.get('/api/resetLimit', AuthMiddleware.authenticate(['admin']), (_req, res) => {
  limitStore.resetAll();
  res.json({
    success: true,
    message: 'Rate limit reset successfully',
  });
});

app.use(superAdminAuthRouter);
app.use(superAdminSchoolRouter);
app.use(superAdminExamTypeRouter);
app.use(schoolContextMiddleware);
app.use(syncRlsSchoolContextMiddleware);
app.use(sharedAuthSessionRouter);
app.use(requireSchoolContextMiddleware);
app.use(enforceSubscriptionAccess);

app.use(studentRouter);
app.use(tenantSchoolRouter);
app.use(examRouter);
app.use(tenantExamTypeRouter);
app.use(subjectRouter);
app.use(marksRouter);
app.use(promotionRouter);
app.use(routerTeacher);
app.use(staffRouter);
app.use(tenantAuthRouter);
app.use(levelRouter);
app.use(attendenceRouter);
app.use(noticeRouter);
app.use(smsSettingsRoute);
app.use(eventsRouter);
app.use('/api/gallery', galleryRouter);
app.use(dashboardRouter);
app.use(syllabusRouter);
app.use(classRoutineRouter);
app.use(citizenCharterRouter);
app.use(registrationSettingsClass9Router);
app.use(registrationFormClass9Router);
app.use(registrationSettingsClass6Router);
app.use(registrationFormClass6Router);
app.use(registrationSettingsClass8Router);
app.use(registrationFormClass8Router);
app.use(registrationSettingsJuniorScholarshipRouter);
app.use(registrationFormJuniorScholarshipRouter);
app.use(admissionRouter);
app.use(admissionFormRouter);
app.use(admissionResultRouter);

app.use(smsRouter);

// Nest mounts after legacy routers; its 404 + error handling (LegacyErrorFilter) close the chain.
let ready: Promise<typeof app> | undefined;
export const createApp = () => (ready ??= createNest(app).then(() => app));
