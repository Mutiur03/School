import type { INestApplication } from '@nestjs/common';

/**
 * TEMPORARY bridge so legacy Express services (exam/teacher) and server.ts can reach Nest
 * providers via `nestApp().get(Provider)`. Delete when exam/teacher move to Nest.
 */
let app: INestApplication | undefined;

export const setNestApp = (nest: INestApplication) => {
  app = nest;
};

export const nestApp = (): INestApplication => {
  if (!app) throw new Error('Nest app is not initialised yet: await createApp() first.');
  return app;
};
