import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  WebhookGetFilter,
  WebhookPutRequest,
} from '../core/app/models/webhook';
import { PSP } from '../core/app/psp';
import { HttpInterceptor } from '../http.interceptor';

@Controller('webhook')
@UseInterceptors(HttpInterceptor)
export class WebhookController {
  constructor(private readonly pspService: PSP) {}

  @Put(':chave')
  async add(
    @Body() data: WebhookPutRequest,
    @Param('chave') chave: string,
    @Headers() headers,
  ) {
    const IdOwner = headers['IdOwner'];
    return await this.pspService.addWebhook({ IdOwner, chave, data });
  }

  @Get(':chave')
  async read(@Param('chave') chave: string, @Headers() headers) {
    const IdOwner = headers['IdOwner'];
    return await this.pspService.readWebhook({ IdOwner, chave });
  }

  @Get()
  list(@Headers() headers, @Query() qry: WebhookGetFilter) {
    const IdOwner = headers['IdOwner'];
    return this.pspService.listWebhook({ ...qry, IdOwner });
  }

  @Delete(':chave')
  @HttpCode(204)
  remove(@Param('chave') chave: string, @Headers() headers) {
    const IdOwner = headers['IdOwner'];
    return this.pspService.removeWebhook({ IdOwner, chave });
  }
}
