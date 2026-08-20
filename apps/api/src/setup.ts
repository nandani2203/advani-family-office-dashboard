import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { SerializeInterceptor } from './common/interceptors/serialize.interceptor';

/**
 * Everything that must be applied identically whether the app is booted by
 * `main.ts` locally or by the Vercel serverless entry point.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const corsOrigins = config.get<string[]>('corsOrigins') ?? ['*'];

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new SerializeInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Advani Family Office — Internal Dashboard API')
    .setDescription(
      'Back-office API for the family office portfolio: investments, assets, ' +
        'transactions, distributions, compliance filings and user management.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addTag('auth', 'Passwordless OTP sign-in and session management')
    .addTag('dashboard', 'Aggregated portfolio metrics')
    .addTag('investments')
    .addTag('assets')
    .addTag('transactions')
    .addTag('distributions')
    .addTag('filings')
    .addTag('users')
    .addTag('health')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
