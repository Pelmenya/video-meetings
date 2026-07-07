import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    configureApp(app);

    app.enableCors({
        origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    });

    const swaggerConfig = new DocumentBuilder()
        .setTitle('Video Meetings API')
        .setDescription('API documentation')
        .setVersion('1.0')
        .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);

    await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
