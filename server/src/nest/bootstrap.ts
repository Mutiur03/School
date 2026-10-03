import 'reflect-metadata';
import type { Express } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { LegacyErrorFilter } from './common/legacy-error.filter.js';
import { ResponseInterceptor } from './common/response.interceptor.js';

/**
 * Mounts Nest controllers on the existing Express app, after all legacy routers.
 * Express already does CORS/body parsing; Nest's 404 + error handlers replace the legacy ones.
 */
export const createNest = async (app: Express) => {
  const nest = await NestFactory.create(AppModule, new ExpressAdapter(app), {
    // Must stay false: Express 4 already parses bodies, and Nest's parser setup reads `app.router` (Express 5 only) → crash.
    bodyParser: false,
  });
  nest.setGlobalPrefix('api');
  nest.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  nest.useGlobalFilters(new LegacyErrorFilter());
  nest.useGlobalInterceptors(new ResponseInterceptor());
  await nest.init();
  return nest;
};
