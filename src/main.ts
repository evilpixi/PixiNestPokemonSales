import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';


async function bootstrap() {
  // rawBody is required to verify Stripe's webhook signature.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const port = app.get(ConfigService).get<number>('PORT', 5173);
  console.log(`configured port is =${port}`)
  await app.listen(port);
}
await bootstrap();
