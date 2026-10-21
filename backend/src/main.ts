import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // Chốt an toàn: không bao giờ cho phép tắt xác thực ở prod
  if (process.env.APP_ENV === 'prod' && process.env.AUTH_DISABLED === 'true') {
    throw new Error('AUTH_DISABLED is not allowed in prod');
  }

  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
  });

  // Cloud Run truyền cổng qua biến PORT (mặc định 8080)
  const port = Number(process.env.PORT ?? 8080);
  await app.listen(port, '0.0.0.0');
  console.log(`Backend [${process.env.APP_ENV ?? 'local'}] listening on :${port}`);
}

bootstrap();
