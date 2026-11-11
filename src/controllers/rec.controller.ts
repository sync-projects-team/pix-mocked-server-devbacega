import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseInterceptors } from "@nestjs/common";
import { RecGetFilter, RecPatchRequest, RecPostRequest, RecRequest } from "../core/app/models/rec";
import { PSP } from "../core/app/psp";
import { HttpInterceptor } from "../http.interceptor";

@Controller("rec")
@UseInterceptors(HttpInterceptor)
export class RecController {
  constructor(private readonly pspService: PSP) { }

  @Post()
  async create(@Body() data: RecPostRequest, @Headers() headers) {
    const IdOwner = headers["IdOwner"];
    const itm: RecRequest<RecPostRequest> = { IdOwner, data }
    return await this.pspService.addRec(itm);
  }

  @Get(":idRec/ativacao")
  async readAtivacao(@Param("idRec") idRec: string, @Headers() headers) {
    const IdOwner = headers["IdOwner"];
    return await this.pspService.readRecAtivacao({ IdOwner, idRec });
  }

  @Get(":idRec")
  async read(@Param("idRec") idRec: string, @Headers() headers) {
    const IdOwner = headers["IdOwner"];
    return await this.pspService.readRec({ IdOwner, idRec });
  }

  @Get()
  list(@Headers() headers, @Query() qry: RecGetFilter) {
    const IdOwner = headers["IdOwner"];
    return this.pspService.listRec({ ...qry, IdOwner });
  }

  @Patch(":idRec")
  edit(@Body() data: RecPatchRequest, @Param("idRec") idRec: string, @Headers() headers) {
    const IdOwner = headers["IdOwner"];
    return this.pspService.editRec({ IdOwner, idRec, data });
  }
}
