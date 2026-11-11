import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { MemoryDB } from "../../libs/fakedb";
import { PixID, PixKey, PixRequest, TipoCob, Situacao, ModalidadeAlteracao, IPaginator, Expiracao, ListFilter } from "./models";
import { getMD5Hash, parseBoolean } from "../../libs/utils";
import { randomUUID } from "crypto";
import { MESSAGES } from "../../libs/messages";
import { CobGetResponse, CobPatchRequest, CobPutRequest, CobPutResponse, CobGetFilter, CobPatchResponse } from "./models/cob";
import { LocGetResponse, LocGetFilter, LocID, LocPutRequest, LocPutResponse } from "./models/loc";
import { CobVGetFilter, CobVGetResponse, CobVPatchRequest, CobVPatchResponse, CobVPutRequest, CobVPutResponse, CobVValor } from "./models/cobv";
import { CobRGetFilter, CobRGetResponse, CobRPatchRequest, CobRPatchResponse, CobRPutRequest, CobRPutResponse, StatusCobR, StatusTentativaCobR } from "./models/cobr";
import { PoliticaRetentativa, RecGetFilter, RecPatchRequest, RecPostRequest, RecRequest, StatusRec } from "./models/rec";
import { WebhookGetFilter, WebhookGetResponse, WebhookPutRequest } from "./models/webhook";
import { owners } from '../../data/db.json'

@Injectable()
export class PSP {

    private cob: MemoryDB;
    private cobR: MemoryDB;
    private transHist: MemoryDB;
    private locations: MemoryDB;
    private correntistas: MemoryDB;
    private loccob: MemoryDB;
    private rec: MemoryDB;
    private webhook: MemoryDB;

    constructor() {

        this.cob = MemoryDB.get("COB");
        this.transHist = MemoryDB.get("COB_HIST");

        this.cobR = MemoryDB.get("COBR");

        this.locations = MemoryDB.get("LOCATIONS");
        this.correntistas = MemoryDB.get("CORRENTISTAS");
        this.loccob = MemoryDB.get("LOC_COB");

        this.rec = MemoryDB.get("REC");
        this.webhook = MemoryDB.get("WEBHOOK");

    }

    private _owner(IdOwner: string) {
        const own = owners.find(f => f.id === IdOwner);
        if (!own) {
            throw new Error(MESSAGES.Errors.defaults.NOT_FOUNT('OWNER'));
        }
        return own;
    }

    private _randomAlnum(size: number): string {
        return randomUUID().replace(/\-/g, '').substring(0, size);
    }

    private _inPeriod(date: string, filter: ListFilter): boolean {
        const d = new Date(date);
        return (!filter.inicio || d >= new Date(filter.inicio)) && (!filter.fim || d <= new Date(filter.fim));
    }

    private _listResult<T>(filter: ListFilter, key: string, items: T[], parametros: object = {}) {
        const paginaAtual = Number(filter.paginacao?.paginaAtual ?? filter['paginacao.paginaAtual'] ?? 0) || 0;
        const itensPorPagina = Number(filter.paginacao?.itensPorPagina ?? filter['paginacao.itensPorPagina'] ?? 100) || 100;
        const ini = paginaAtual * itensPorPagina;

        return {
            parametros: {
                inicio: filter.inicio,
                fim: filter.fim,
                ...parametros,
                paginacao: {
                    paginaAtual,
                    itensPorPagina,
                    quantidadeDePaginas: Math.ceil(items.length / itensPorPagina),
                    quantidadeTotalDeItens: items.length
                }
            },
            [key]: items.slice(ini, ini + itensPorPagina)
        };
    }

    private async joinLocCob(IdOwner: string, txid: string, id: number, tipoCob: TipoCob) {
        const lc1 = await this.loccob.read(IdOwner, { txid });
        const lc2 = await this.loccob.read(IdOwner, { id });

        const cob = await this.cob.read(IdOwner, { txid })
        const loc = await this.locations.read(IdOwner, { id })

        if (lc2) {
            throw new Error('LOCATION JÁ ESTÁ VINCULADO A UMA COBRANÇA');
        }
        // if (lc1) {
        //     throw new Error('COBRANÇA JÁ ESTÁ VINCULADO A UMA LOCATION');
        // }

        // if (!cob) {
        //     throw new Error(MESSAGES.Errors.defaults.NOT_FOUNT(TipoCob[tipoCob]));
        // }

        if (!loc) {
            throw new Error(MESSAGES.Errors.defaults.NOT_FOUNT('location'));
        }

        if (loc.tipoCob != tipoCob) {
            throw new Error(MESSAGES.Errors.defaults.UNEXPECTED_VALUE('tipoCob', loc.tipoCob));
        }

        await this.loccob.add(IdOwner, { txid, id });
    }

    private async _addCob(itm: PixRequest<CobPutRequest | CobVPutRequest>, tipoCob: TipoCob) {
        if (itm.data.valor.retirada) {
            throw new Error('NÃO IMPLEMENTADO');
        }

        if (!itm.data.valor.modalidadeAlteracao) {
            itm.data.valor.modalidadeAlteracao = ModalidadeAlteracao.NaoEditavel;
        }

        if (tipoCob == TipoCob.imediato) {
            if (!itm.data.calendario || !(itm.data.calendario as Expiracao)?.expiracao) {
                itm.data.calendario = { expiracao: 86400 }
            }
        }

        const curr = { ...itm.data, txid: itm.txid, revisao: 0, status: Situacao.Ativa, criacao: (new Date()).toJSON() };

        //INCLUI  LOCATION E TRANSAÇÃO, PARA DEPOIS VINCULÁ-LAS  
        const { id } = await this.addLoc({ tipoCob, IdOwner: itm.IdOwner })
        await this.cob.add(itm.IdOwner, curr);
        await this.joinLocCob(itm.IdOwner, itm.txid, id, tipoCob);

        return await this._readCob({ IdOwner: itm.IdOwner, txid: itm.txid });
    }

    async addCob(itm: PixRequest<CobPutRequest>): Promise<CobPutResponse> {
        return (await this._addCob(itm, TipoCob.imediato)) as CobPutResponse;
    }

    async addCobR(itm: PixRequest<CobRPutRequest>): Promise<CobRPutResponse> {
        const rec = await this.rec.read(itm.IdOwner, { idRec: itm.data.idRec });
        if (!rec) {
            throw new BadRequestException({ idRec: 'O campo $$ não corresponde a uma recorrência existente.' });
        }
        if (await this.cobR.read(itm.IdOwner, { txid: itm.txid })) {
            throw new BadRequestException({ txid: 'O campo $$ já está em uso.' });
        }

        const criacao = (new Date()).toJSON();
        await this.cobR.add(itm.IdOwner, {
            ...itm.data,
            txid: itm.txid,
            ajusteDiaUtil: itm.data.ajusteDiaUtil ?? true,
            calendario: { ...itm.data.calendario, criacao },
            status: StatusCobR.Criada,
            politicaRetentativa: rec.politicaRetentativa,
            atualizacao: [{ status: StatusCobR.Criada, data: criacao }],
            tentativas: []
        });

        return await this.readCobR({ IdOwner: itm.IdOwner, txid: itm.txid });
    }

    async readCobR(key: PixKey): Promise<CobRGetResponse> {
        return await this.cobR.read(key.IdOwner, { txid: key.txid });
    }

    async listCobR(filter: CobRGetFilter & { IdOwner: string }) {
        const recs = await this.rec.list(filter.IdOwner);
        const doc = filter.cpf || filter.cnpj;

        const cobsr = (await this.cobR.list(filter.IdOwner)).filter((f: CobRGetResponse) => {
            const devedor = recs.find(r => r.idRec === f.idRec)?.vinculo?.devedor;
            return this._inPeriod(f.calendario.criacao, filter)
                && (!filter.idRec || f.idRec === filter.idRec)
                && (!filter.status || f.status === filter.status)
                && (!doc || devedor?.cpf === doc || devedor?.cnpj === doc);
        });

        return this._listResult(filter, 'cobsr', cobsr, { idRec: filter.idRec, cpf: filter.cpf, cnpj: filter.cnpj, status: filter.status });
    }

    async editCobR(itm: PixRequest<CobRPatchRequest>): Promise<CobRPatchResponse> {
        const curr = await this.readCobR(itm);
        if (!curr) {
            return undefined;
        }
        if (itm.data.status && curr.status !== itm.data.status) {
            if (![StatusCobR.Criada, StatusCobR.Ativa].includes(curr.status)) {
                throw new BadRequestException({ status: `A cobrança no status ${curr.status} não pode ser alterada.` });
            }
            await this.cobR.patch(itm.IdOwner, { txid: itm.txid }, {
                status: itm.data.status,
                atualizacao: [...curr.atualizacao, { status: itm.data.status, data: (new Date()).toJSON() }]
            });
        }
        return await this.readCobR(itm);
    }

    async retentativaCobR(key: PixKey & { data: string }): Promise<CobRGetResponse> {
        const curr = await this.readCobR(key);
        if (!curr) {
            throw new NotFoundException();
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key.data) || isNaN(Date.parse(key.data))) {
            throw new BadRequestException({ data: 'O campo $$ não respeita o schema.' });
        }
        if (curr.politicaRetentativa !== PoliticaRetentativa.Permite) {
            throw new BadRequestException({ politicaRetentativa: 'A recorrência não permite retentativas.' });
        }
        if (curr.tentativas.filter(f => f.tipo === 'NTAG').length >= 3) {
            throw new BadRequestException({ tentativas: 'O limite de 3 retentativas foi atingido.' });
        }

        const agora = (new Date()).toJSON();
        await this.cobR.patch(key.IdOwner, { txid: key.txid }, {
            tentativas: [...curr.tentativas, {
                dataLiquidacao: key.data,
                tipo: 'NTAG',
                status: StatusTentativaCobR.Solicitada,
                atualizacao: [{ status: StatusTentativaCobR.Solicitada, data: agora }]
            }]
        });
        return await this.readCobR(key);
    }

    async addCobV(itm: PixRequest<CobVPutRequest>): Promise<CobVPutResponse> {
        return (await this._addCob(itm, TipoCob.vencimento)) as CobVPutResponse;
    }

    async _readCob<T extends CobGetResponse | CobVGetResponse>(key: PixKey, revisao?: number): Promise<T> {

        const last = () => this.cob.read(key.IdOwner, { txid: key.txid });
        const hist = () => this.transHist.read(key.IdOwner, { id: getMD5Hash(key.txid, revisao) });

        const curr = revisao ? (await hist()) || (await last()) : (await last());
        if (!curr) { return undefined }

        const c = await this.correntistas.read("DEV", { chave: curr.chave });
        if (!c) { throw new Error(MESSAGES.Errors.defaults.NOT_FOUNT('Correntista')) }


        const loccob = await this.loccob.read(key.IdOwner, { txid: curr.txid });
        let loc: LocGetResponse = undefined;

        if (loccob) {
            loc = await this.locations.read(key.IdOwner, { id: loccob.id });
            if (!loc) { throw new Error(MESSAGES.Errors.defaults.NOT_FOUNT('Location')) }
            loc.location = `pix.example.com/qr/${loc.uuid}`
        }

        const res = {
            ...curr,
            loc: loc,
            location: loc?.location
        }

        return res;
    }

    async readCob(key: PixKey, revisao?: number): Promise<CobGetResponse> {
        return await this._readCob(key, revisao);
    }

    async readCobV(key: PixKey, revisao?: number): Promise<CobVGetResponse> {
        return await this._readCob(key, revisao);
    }

    async _listCob(filter: (CobGetFilter | CobVGetFilter) & { IdOwner: string }): Promise<IPaginator & { cobs: (CobGetResponse | CobVGetResponse)[] }> {
        const res: IPaginator = {
            parametros: {
                inicio: filter.inicio,
                fim: filter.fim,
                paginacao: {
                    paginaAtual: filter.paginacao?.paginaAtual || 0,
                    itensPorPagina: filter.paginacao?.itensPorPagina || 100,
                    quantidadeDePaginas: 0,
                    quantidadeTotalDeItens: 0
                }
            }
        };

        let chave: string = undefined;

        if (filter.cnpj || filter.cpf) {
            const correntista = await this.correntistas.read("DEV", { cpfcnpj: filter.cnpj || filter.cpf })

            //CORRENTISTA NÃO ENCONTRADO RETORNA LISTA VAZIA
            if (!correntista) {
                return { ...res, cobs: [] }
            }
            else {
                chave = correntista.chave
            }
        }

        const ls = await this.cob.list(filter.IdOwner);

        let cobs = await Promise.all(
            ls.filter((f: any) => {
                const [criacao, inicio, fim] = [new Date(f.criacao), new Date(filter.inicio), new Date(filter.fim)]
                return criacao >= inicio && criacao <= fim && (!chave || f.chave === chave)
            })
                .map<Promise<CobGetResponse | CobVGetResponse>>(m => this._readCob({ IdOwner: filter.IdOwner, txid: m.txid }))
        );

        if (filter.locationPresente !== undefined) {
            cobs = cobs.filter((f: CobGetResponse) => {
                const res = (!!f.loc?.id && !!filter.locationPresente) || (!f.loc?.id && !filter.locationPresente)
                return res;
            });
        }

        const ini = res.parametros.paginacao.paginaAtual * res.parametros.paginacao.itensPorPagina;
        const fim = ini + res.parametros.paginacao.itensPorPagina;
        res.parametros.paginacao.quantidadeDePaginas = Math.ceil(cobs.length / res.parametros.paginacao.itensPorPagina)
        res.parametros.paginacao.quantidadeTotalDeItens = cobs.length;
        return { ...res, cobs: cobs.slice(ini, fim) }
    }

    async listCob(filter: CobGetFilter & { IdOwner: string }) {
        return await this._listCob(filter)
    }

    async listCobV(filter: CobVGetFilter & { IdOwner: string }) {
        return await this._listCob(filter)
    }

    async _editCob(itm: PixRequest<CobPatchRequest | CobVPatchRequest>, tipoCob: TipoCob) {
        const curr = await this._readCob(itm);
        let add = false;

        if (!curr || curr.status != Situacao.Ativa) {
            return null
        }
        else {
            if (!!itm.data.devedor || !!itm.data.solicitacaoPagador || !!itm.data.valor || !!itm.data.calendario || itm.data.status) {
                add = true
            }

            if (itm.data.loc?.id != null) {
                const lc = await this.loccob.read(itm.IdOwner, { txid: itm.txid });

                if (lc?.id != itm.data.loc.id) {
                    await this.loccob.remove(itm.IdOwner, { id: lc.id });
                    try { await this.joinLocCob(itm.IdOwner, itm.txid, itm.data.loc.id, tipoCob); }
                    catch (ex) {
                        await this.loccob.add(itm.IdOwner, { id: lc.id }); //desfaz a exclusão
                        throw ex;
                    }
                }
            }

            const histId = getMD5Hash(curr.txid, curr.revisao);
            if (add) {
                await this.transHist.add(itm.IdOwner, { id: histId, ...curr });
                curr.revisao++;

                itm.data.valor = {
                    original: itm.data.valor?.original || curr.valor.original,
                    modalidadeAlteracao: itm.data.valor?.modalidadeAlteracao || curr.valor.modalidadeAlteracao
                };

                if (tipoCob === TipoCob.vencimento && itm.data.valor) {
                    const valor = itm.data.valor as CobVValor;
                    const currV = curr.valor as CobVValor;
                    itm.data.valor = {
                        ...itm.data.valor,
                        desconto: {
                            data: valor.desconto?.data || currV.desconto.data,
                            modalidade: valor.desconto?.modalidade || currV.desconto.modalidade,
                            valorPerc: valor.desconto?.valorPerc || currV.desconto.valorPerc
                        },
                        juros: {
                            modalidade: valor.juros?.modalidade || currV.juros.modalidade,
                            valorPerc: valor.juros?.valorPerc || currV.juros.valorPerc
                        },
                        multa: {
                            modalidade: valor.multa?.modalidade || currV.multa.modalidade,
                            valorPerc: valor.multa?.valorPerc || currV.multa.valorPerc
                        }
                    }
                }

                await this.cob.update(itm.IdOwner, { txid: itm.txid }, { ...curr, ...itm.data });
            }
            else {
                await this.cob.patch(itm.IdOwner, { txid: itm.txid }, { loc: curr.loc });
            }

            return await this._readCob({ IdOwner: itm.IdOwner, txid: itm.txid });
        }
    }

    async editCob(itm: PixRequest<CobPatchRequest>): Promise<CobPatchResponse> {
        return (await this._editCob(itm, TipoCob.imediato)) as CobPatchResponse;
    }

    async editCobV(itm: PixRequest<CobVPatchRequest>): Promise<CobVPatchResponse> {
        return (await this._editCob(itm, TipoCob.vencimento)) as CobVPatchResponse;
    }

    async _removeCob(key: PixID & { IdOwner: string }): Promise<boolean> {
        await this.loccob.remove(key.IdOwner, { txid: key.txid });
        return await this.cob.remove(key.IdOwner, { txid: key.txid });
    }
    async removeCob(key: PixID & { IdOwner: string }): Promise<boolean> {
        return this._removeCob(key);
    }
    async removeCobV(key: PixID & { IdOwner: string }): Promise<boolean> {
        return this._removeCob(key);
    }

    async readLoc({ IdOwner, id }: LocID & { IdOwner: string }): Promise<LocGetResponse> {
        const itm: any = await this.locations.read(IdOwner, { id });
        if (itm) {
            const lc = await this.loccob.read(IdOwner, { id })
            return { ...itm, ...(lc?.txid ? { txid: lc?.txid } : {}), location: `pix.example.com/qr/${itm.uuid}` }
        }
    }

    async listLoc(filter: LocGetFilter & { IdOwner: string }) {

        const res = {
            parametros: {
                inicio: filter.inicio,
                fim: filter.fim,
                paginacao: {
                    paginaAtual: filter.paginacao?.paginaAtual || 0,
                    itensPorPagina: filter.paginacao?.itensPorPagina || 100,
                    quantidadeDePaginas: 0,
                    quantidadeTotalDeItens: 0
                }
            }
        };

        //Carrega Locations e correlação entre Location e Cob(x)
        const ls = await Promise.all([
            this.locations.list(filter.IdOwner),
            this.loccob.list(filter.IdOwner)
        ]).then(([_locs, _cobs]) => {

            if (filter.tipoCob !== undefined) {
                _locs = _locs.filter((f: LocGetResponse) => f.tipoCob === filter.tipoCob);
            }

            //Left Join Loc x LocCob
            return _locs.map(m => {
                const _cob = _cobs.find(f => f.id === m.id);
                return _cob ? { ...m, txid: _cob.txid, location: `pix.example.com/qr/${m.uuid}` } : m;
            })
        });

        let loc = ls.filter((f: any) => {
            const [criacao, inicio, fim] = [new Date(f.criacao), new Date(filter.inicio), new Date(filter.fim)]
            return criacao >= inicio && criacao <= fim
        })

        if (filter.txIdPresente !== undefined) {

            loc = loc.filter((f: LocGetResponse & { cob: any }) => {
                const res = (!!f.txid && !!filter.txIdPresente) || (!f.txid && !filter.txIdPresente)
                return res;
            });
        }

        const ini = res.parametros.paginacao.paginaAtual * res.parametros.paginacao.itensPorPagina;
        const fim = ini + res.parametros.paginacao.itensPorPagina;
        res.parametros.paginacao.quantidadeDePaginas = Math.ceil(loc.length / res.parametros.paginacao.itensPorPagina)
        res.parametros.paginacao.quantidadeTotalDeItens = loc.length;
        return { ...res, loc: loc.slice(ini, fim) }
    }

    async readLocUUID(IdOwner: string, uuid: string): Promise<LocGetResponse> {
        const itm: any = await this.locations.read(IdOwner, { uuid });
        if (itm) {
            const lc = await this.loccob.read(IdOwner, { id: itm.id })
            return { ...itm, txid: lc?.txid, location: `pix.example.com/qr/${itm.uuid}` }
        }
    }

    async addLoc({ tipoCob, IdOwner }: LocPutRequest & { IdOwner: string }): Promise<LocPutResponse> {
        await (() => new Promise<void>(res => setTimeout(() => res(), 100)))(); //delay -- WORKAROUND PRA EVITAR COLISÃO DE ID DURANTE OS TESTES
        const id = + new Date();
        const itm = { id, tipoCob, uuid: randomUUID().replace(/\-/g, ''), criacao: (new Date()).toJSON() };
        await this.locations.add(IdOwner, itm)
        return await this.readLoc({ IdOwner, id });
    }

    async removeLoc({ id, IdOwner }: LocID & { IdOwner: string }): Promise<boolean> {
        return await this.loccob.remove(IdOwner, { id });
    }

    async addRec(mdl: RecRequest<RecPostRequest>) {
        const own = this._owner(mdl.IdOwner);
        const criacao = (new Date()).toJSON();
        const retentativa = mdl.data.politicaRetentativa === PoliticaRetentativa.NaoPermite ? 'N' : 'R';
        const idRec = `R${retentativa}${own.ISPB}${criacao.replace(/\D/g, '').substring(0, 8)}${this._randomAlnum(11)}`;

        await this.rec.add(mdl.IdOwner, {
            ...mdl.data,
            idRec,
            status: StatusRec.Criada,
            atualizacao: [{ status: StatusRec.Criada, data: criacao }]
        });
        return await this.readRec({ IdOwner: mdl.IdOwner, idRec });
    }

    async readRec({ IdOwner, idRec }: { IdOwner: string, idRec: string }) {
        return await this.rec.read(IdOwner, { idRec });
    }

    async listRec(filter: RecGetFilter & { IdOwner: string }) {
        const doc = filter.cpf || filter.cnpj;
        const recs = (await this.rec.list(filter.IdOwner)).filter(f =>
            this._inPeriod(f.atualizacao[0].data, filter)
            && (!filter.status || f.status === filter.status)
            && (!doc || f.vinculo?.devedor?.cpf === doc || f.vinculo?.devedor?.cnpj === doc)
        );

        return this._listResult(filter, 'recs', recs, { cpf: filter.cpf, cnpj: filter.cnpj, status: filter.status });
    }

    async editRec(mdl: RecRequest<RecPatchRequest> & { idRec: string }) {
        const curr = await this.readRec(mdl);
        if (!curr) {
            return undefined;
        }
        if (![StatusRec.Criada, StatusRec.Aprovada].includes(curr.status)) {
            throw new BadRequestException({ status: `A recorrência no status ${curr.status} não pode ser alterada.` });
        }

        const { status, vinculo, calendario } = mdl.data;
        await this.rec.patch(mdl.IdOwner, { idRec: mdl.idRec }, {
            ...(status ? { status, atualizacao: [...curr.atualizacao, { status, data: (new Date()).toJSON() }] } : {}),
            ...(vinculo?.devedor?.nome ? { vinculo: { ...curr.vinculo, devedor: { ...curr.vinculo.devedor, nome: vinculo.devedor.nome } } } : {}),
            ...(calendario?.dataInicial ? { calendario: { ...curr.calendario, dataInicial: calendario.dataInicial } } : {})
        });
        return await this.readRec(mdl);
    }

    async readRecAtivacao(key: { IdOwner: string, idRec: string }) {
        const curr = await this.readRec(key);
        if (!curr) {
            return undefined;
        }
        return {
            idRec: curr.idRec,
            status: curr.status,
            ativacao: {
                tipoJornada: curr.ativacao?.dadosJornada?.txid ? 'JORNADA_3' : 'AGUARDANDO_DEFINICAO',
                dadosJornada: curr.ativacao?.dadosJornada
            }
        };
    }

    async addWebhook({ IdOwner, chave, data }: { IdOwner: string, chave: string, data: WebhookPutRequest }): Promise<WebhookGetResponse> {
        if (!(await this.correntistas.read("DEV", { chave }))) {
            throw new BadRequestException({ chave: 'O campo $$ não corresponde a uma chave do usuário recebedor.' });
        }

        const curr = await this.readWebhook({ IdOwner, chave });
        if (curr) {
            return await this.webhook.patch(IdOwner, { chave }, { webhookUrl: data.webhookUrl });
        }
        return await this.webhook.add(IdOwner, { webhookUrl: data.webhookUrl, chave, criacao: (new Date()).toJSON() });
    }

    async readWebhook({ IdOwner, chave }: { IdOwner: string, chave: string }): Promise<WebhookGetResponse> {
        return await this.webhook.read(IdOwner, { chave });
    }

    async listWebhook(filter: WebhookGetFilter & { IdOwner: string }) {
        const webhooks = (await this.webhook.list(filter.IdOwner)).filter(f => this._inPeriod(f.criacao, filter));
        return this._listResult(filter, 'webhooks', webhooks);
    }

    async removeWebhook({ IdOwner, chave }: { IdOwner: string, chave: string }): Promise<boolean> {
        return await this.webhook.remove(IdOwner, { chave });
    }
}

