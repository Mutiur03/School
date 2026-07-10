import { PrismaClient } from "@prisma/client";
import { getRlsContext, patchRlsContext } from "@/config/rlsContextStore.js";
import logger from "@/utils/logger.js";
import { recordSlowQueryBreadcrumb } from "@/config/sentry.js";

type QueryLoggingPrismaClient = PrismaClient<
  {
    log: [
      { emit: "event"; level: "query" },
      { emit: "stdout"; level: "warn" },
      { emit: "stdout"; level: "error" },
    ];
  },
  "query"
>;

/** @type {Object} */
const globalForPrisma = global as unknown as {
  prisma: QueryLoggingPrismaClient | undefined;
};

const isProduction = process.env.NODE_ENV === "production";
const logAllQueries = process.env.PRISMA_LOG_QUERIES === "true";
const slowQueryMs = Number(process.env.PRISMA_SLOW_QUERY_MS || "500");

const prismaLogConfig = [
  { emit: "event", level: "query" },
  { emit: "stdout", level: "warn" },
  { emit: "stdout", level: "error" },
] as const;

const basePrisma: QueryLoggingPrismaClient =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: [...prismaLogConfig],
  });

if (!globalForPrisma.prisma) {
  basePrisma.$on("query", (event) => {
    const isSlow = event.duration >= slowQueryMs;
    const shouldLog = logAllQueries || !isProduction || isSlow;

    if (shouldLog) {
      const logPayload = {
        query: event.query,
        params: event.params,
        duration_ms: event.duration,
        slow: isSlow,
      };

      if (isSlow) {
        logger.warn("Slow prisma query", logPayload);
      } else {
        logger.debug("Prisma query", logPayload);
      }
    }

    if (isSlow) {
      recordSlowQueryBreadcrumb(event);
    }
  });
}

const TENANT_MODELS = new Set([
  "admin",
  "admission",
  "admission_form",
  "admission_result",
  "attendence",
  "categories",
  "citizencharter",
  "class6_reg",
  "class8_reg",
  "class_routine",
  "class_routine_pdf",
  "class_slot_time",
  "events",
  "exam_class_stats",
  "exam_routines",
  "exams",
  "gallery",
  "head_msg",
  "holidays",
  "levels",
  "marks",
  "notices",
  "schoolsiteconfig",
  "sms_logs",
  "sms_settings",
  "ssc_reg",
  "staffs",
  "student_enrollments",
  "student_registration_class6",
  "student_registration_class8",
  "student_registration_ssc",
  "students",
  "subjects",
  "syllabus",
  "teachers",
]);

const extendedPrisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const isTenantModel =
          typeof model === "string" && TENANT_MODELS.has(model.toLowerCase());
        const context = getRlsContext();

        if (!context) {
          if (isTenantModel) {
            throw new Error(
              `RLS context missing for tenant model operation: ${String(model)}.${String(operation)}`,
            );
          }
          return query(args);
        }

        if (context.inRlsTransaction) {
          return query(args);
        }

        const { schoolId, isSuperAdmin } = context;

        if (!isSuperAdmin && !Number.isInteger(schoolId)) {
          if (isTenantModel) {
            throw new Error(
              `School context missing for tenant model operation: ${String(model)}.${String(operation)}`,
            );
          }
          return query(args);
        }

        return basePrisma.$transaction(async (tx) => {
          patchRlsContext({ inRlsTransaction: true });

          await tx.$executeRaw`
            SELECT set_config('app.is_super_admin', ${isSuperAdmin ? "1" : "0"}, true)
          `;

          await tx.$executeRaw`
            SELECT set_config('app.school_id', ${schoolId ? String(schoolId) : ""}, true)
          `;

          try {
            return (tx as any)[model][operation](args);
          } finally {
            patchRlsContext({ inRlsTransaction: false });
          }
        });
      },
    },
  },
});

export const prisma = extendedPrisma as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;
