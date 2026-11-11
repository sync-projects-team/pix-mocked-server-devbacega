import { Module } from '@nestjs/common';
import { CobController } from './controllers/cob.controller';
import { PSP } from './core/app/psp';
import { CobVController } from './controllers/cobv.controller';
import { LocationController } from './controllers/location.controller';
import { RecController } from './controllers/rec.controller';
import { CobRController } from './controllers/cobr.controller';
import { WebhookController } from './controllers/webhook.controller';
import { PixController } from './controllers/pix.controller';

@Module({
  imports: [],
  controllers: [CobController, CobVController, CobRController, LocationController, RecController, WebhookController, PixController],
  providers: [PSP],
})
export class AppModule {

}