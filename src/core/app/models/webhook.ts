import { IsDefined, IsUrl } from "class-validator"
import { ListFilter } from "../models"

export class WebhookPutRequest {
    @IsDefined({ message: 'O campo $$ não respeita o schema.' })
    @IsUrl({ require_protocol: true }, { message: 'O campo $$ não respeita o schema.' })
    webhookUrl: string
}

export class WebhookGetResponse {
    webhookUrl: string
    chave: string
    criacao: string
}

export class WebhookGetFilter extends ListFilter { }
