import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { envs } from './config/envs';
process.env.TZ = 'America/Lima';
async function bootstrap() {
  const logger = new Logger('NEXUS PLATAFORMA');
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [envs.frontendUrl, 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  });

  app.useWebSocketAdapter(new IoAdapter(app));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
        exposeDefaultValues: true,
      },
    }),
  );
  await app.listen(envs.port);
  logger.log(`Server running on port ${envs.port}`);
}
bootstrap();
