import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';
import { configureApp } from './setup';

let cached: express.Express | null = null;

/**
 * Boots Nest once per warm serverless container and hands back the underlying
 * Express instance. Subsequent invocations reuse it, so only a cold start pays
 * the initialisation cost.
 */
export async function bootstrapServer(): Promise<express.Express> {
  if (cached) return cached;

  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['error', 'warn', 'log'],
  });

  configureApp(app);
  await app.init();

  cached = expressApp;
  return expressApp;
}
