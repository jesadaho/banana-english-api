import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  const corsOrigins = config.get<string>('CORS_ORIGINS', '');

  app.enableCors({
    origin: (origin, callback) => {
      // Server-to-server / curl
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowed = corsOrigins
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

      if (allowed.includes(origin)) {
        callback(null, true);
        return;
      }

      // Flutter web dev (random localhost ports)
      if (/^http:\/\/localhost:\d+$/.test(origin)) {
        callback(null, true);
        return;
      }
      if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = parseInt(process.env.PORT ?? '8000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`Banana English API listening on 0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
