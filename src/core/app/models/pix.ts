import { ListFilter } from "../models"
import { IsCNPJValid, IsCPFValid } from "../../../validators/custom-validators"

export class PixGetResponse {
    endToEndId: string
    txid?: string
    valor: string
    chave: string
    horario: string
    infoPagador?: string
    pagador?: { nome: string, cpf?: string, cnpj?: string }
    devolucoes: any[]
}

export class PixGetFilter extends ListFilter {
    txid?: string
    txIdPresente?: boolean | string
    devolucaoPresente?: boolean | string
    @IsCPFValid({ message: 'O campo $$ não respeita o schema.' })
    cpf?: string
    @IsCNPJValid({ message: 'O campo $$ não respeita o schema.' })
    cnpj?: string
}
