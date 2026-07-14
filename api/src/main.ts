//Standalone dig map API. Serves only backend endpoints; all static content
//(the map page, tiles, admin page) is served by Apache directly.
//Bound to 127.0.0.1 on purpose: the only client is the Apache reverse
//proxy on the same machine, so the port is never exposed to the internet.
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*' });
  const port = Number(process.env.API_PORT) || 3001;
  await app.listen(port, '127.0.0.1');
  console.log(`dig map api listening on 127.0.0.1:${port}`);
}
bootstrap();
