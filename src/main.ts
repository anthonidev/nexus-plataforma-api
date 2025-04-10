import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { envs } from './config/envs';
import { Logger, ValidationPipe } from '@nestjs/common';
process.env.TZ = 'America/Lima';
async function bootstrap() {
  const logger = new Logger('NEXUS PLATAFORMA');
  const app = await NestFactory.create(AppModule);

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
