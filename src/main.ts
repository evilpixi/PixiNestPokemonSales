import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  console.log(`configured port is =${process.env.PORT}`)
  await app.listen(process.env.PORT ?? 5173);
}
await bootstrap();
