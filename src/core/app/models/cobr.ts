import { IsBoolean, IsDefined, IsIn, IsNotEmpty, IsNotEmptyObject, IsNumberString, MaxLength, ValidateNested } from "class-validator"
import { PixID, Vencimento, DadosPessoa, DadosConta, ICriacao, ListFilter } from "../models"
import { Type } from "class-transformer"
import { IsCNPJValid, IsCPFValid, MinStringNumber } from "../../../validators/custom-validators";
import { PoliticaRetentativa } from "./rec";

/** 	
Todos os campos que indicam valores monetários obedecem ao pattern \d{1,10}.\d{2}. O separador decimal é o caractere ponto. Não é aplicável utilizar separador de milhar. Exemplos de valores aderentes ao padrão: “1.00”, “123.99”, “123456789.23" */
export class Valor {
    @IsNotEmpty({ message: 'O campo $$ não respeita o schema.' })
    @IsNumberString({}, { message: 'O campo $$ não respeita o schema.' })
    @MinStringNumber(0.01, { message: 'O campo $$ é zero.' })
    original: string
}

export enum StatusCobR {
    Criada = "CRIADA",
    Ativa = "ATIVA",
    Concluida = "CONCLUIDA",
    Expirada = "EXPIRADA",
    Rejeitada = "REJEITADA",
    Cancelada = "CANCELADA"
}

export enum StatusTentativaCobR {
    Solicitada = "SOLICITADA",
    Agendada = "AGENDADA",
    Paga = "PAGA",
    Cancelada = "CANCELADA",
    Rejeitada = "REJEITADA",
    Expirada = "EXPIRADA"
}

export interface ITentativaCobR {
    dataLiquidacao: string
    tipo: "AGND" | "NTAG" | "RIFL"
    status: StatusTentativaCobR
    atualizacao: { status: StatusTentativaCobR, data: string }[]
}

export class CobRPutRequest {
    @IsNotEmpty({ message: 'O campo $$ não respeita o schema.' })
    idRec: string

    @MaxLength(140, { message: 'O campo $$ não respeita o schema.' })
    infoAdicional?: string

    @IsDefined({ message: 'O objeto $$ não respeita o schema.' })
    @IsNotEmptyObject({ nullable: false }, { message: 'O objeto $$ não respeita o schema.' })
    @ValidateNested({})
    @Type(() => Vencimento)
    calendario: Vencimento

    @IsDefined({ message: 'O objeto $$ não respeita o schema.' })
    @IsNotEmptyObject({ nullable: false }, { message: 'O objeto $$ não respeita o schema.' })
    @ValidateNested({})
    @Type(() => Valor)
    valor: Valor

    @IsBoolean({ message: 'O campo $$ não respeita o schema.' })
    ajusteDiaUtil?: boolean

    @ValidateNested({})
    @Type(() => DadosPessoa)
    devedor?: DadosPessoa

    @ValidateNested({})
    @Type(() => DadosConta)
    recebedor?: DadosConta
}

export class CobRPatchRequest {
    @IsIn([StatusCobR.Cancelada], { message: 'O campo $$ não respeita o schema.' })
    status?: StatusCobR.Cancelada
}

export class CobRGetResponse implements PixID {
    idRec: string
    txid: string
    infoAdicional?: string
    calendario: Vencimento & ICriacao
    valor: Valor
    ajusteDiaUtil: boolean
    devedor?: DadosPessoa
    recebedor?: DadosConta
    status: StatusCobR
    politicaRetentativa: PoliticaRetentativa
    atualizacao: { status: StatusCobR, data: string }[]
    tentativas: ITentativaCobR[]
}

export class CobRPutResponse extends CobRGetResponse { }

export class CobRPatchResponse extends CobRGetResponse { }

export class CobRGetFilter extends ListFilter {
    idRec?: string
    @IsCPFValid({ message: 'O campo $$ não respeita o schema.' })
    cpf?: string
    @IsCNPJValid({ message: 'O campo $$ não respeita o schema.' })
    cnpj?: string
    status?: StatusCobR
}
