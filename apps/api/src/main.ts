import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApp(app);

  const port = app.get(ConfigService).get<number>('port') ?? 4000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API listening on http://localhost:${port}/api`);
  logger.log(`Swagger docs on http://localhost:${port}/api/docs`);
}

void bootstrap();
