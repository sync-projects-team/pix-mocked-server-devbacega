import {
  Controller,
  Get,
  Headers,
  Param,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { PixGetFilter } from '../core/app/models/pix';
import { PSP } from '../core/app/psp';
import { HttpInterceptor } from '../http.interceptor';

@Controller('pix')
@UseInterceptors(HttpInterceptor)
export class PixController {
  constructor(private readonly pspService: PSP) {}

  @Get(':e2eid')
  async read(@Param('e2eid') e2eid: string, @Headers() headers) {
    const IdOwner = headers['IdOwner'];
    return await this.pspService.readPix({ IdOwner, e2eid });
  }

  @Get()
  list(@Headers() headers, @Query() qry: PixGetFilter) {
    const IdOwner = headers['IdOwner'];
    return this.pspService.listPix({ ...qry, IdOwner });
  }
}
