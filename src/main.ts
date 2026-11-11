import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AuthModule } from './auth.module';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerAppConfig } from './swagger-app.config';
import { swaggerAuthConfig } from './swagger-auth.config';
import { createValidationPipe, setupDatabase } from './bootstrap';

async function bootstrap() {
  await setupDatabase();

  //SERVIÇO PRINCIPAL
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(createValidationPipe());

  const appDocument = SwaggerModule.createDocument(app, swaggerAppConfig);
  SwaggerModule.setup('api-docs', app, appDocument);

  await app.listen(3000);

  //SERVIÇO DE AUTENTICAÇÃO
  const auth = await NestFactory.create(AuthModule);

  const authDocument = SwaggerModule.createDocument(auth, swaggerAuthConfig);
  SwaggerModule.setup('api-docs', auth, authDocument);

  await auth.listen(3001);
}
bootstrap();
