import { PrismaClient } from "@prisma/client";
import { getRlsContext, patchRlsContext } from "@/config/rlsContextStore.js";

/** @type {Object} */
const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

const basePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error"],
  });

const extendedPrisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const context = getRlsContext();

        if (!context || context.inRlsTransaction) {
          return query(args);
        }

        const { schoolId, isSuperAdmin } = context;

        if (!isSuperAdmin && !Number.isInteger(schoolId)) {
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
