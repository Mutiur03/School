/** Minimal env for security regression tests that load auth/prisma modules. */
process.env.DATABASE_URL ??= 'postgresql://localhost:5432/school_test';
process.env.JWT_SECRET ??= 'security-regression-test-jwt-secret-key';
process.env.ENCRYPTION_KEY ??= '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
