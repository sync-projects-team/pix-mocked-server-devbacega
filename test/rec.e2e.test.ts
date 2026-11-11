import { BadRequestException, INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { randomUUID } from "crypto";
import { AppModule } from "../src/app.module";
import { MemoryDB } from "../src/libs/fakedb";
import { errorFormatter, flatDate } from "../src/libs/utils";
import { AtivacaoRecorrencia, PeriodicidadeRecorrencia, PoliticaRetentativa, RecPostRequest } from "../src/core/app/models/rec";
import { gerarCPF } from "../src/libs/documentos";
import { expectPost200, expectPost201, expectPost400, expectPost401, expectRequest } from "./e2e";
import { buildRec } from "./fixtures";

describe('REC', () => {
    let app: INestApplication;


    beforeAll(async () => {

        MemoryDB.create("REC", ['idRec']);

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({
            disableErrorMessages: false,
            transform: true,
            skipMissingProperties: true,
            exceptionFactory: (errors) => {
                throw new BadRequestException(errorFormatter(errors))

            }
        }));
        await app.init();
    });

    let itm: RecPostRequest = {
        vinculo: {
            objeto: "Pagamento de assinatura de serviço",
            contrato: randomUUID().replace(/\-/g, ''),
            devedor: {
                cep: "26083190",
                cidade: "Nova Iguaçu",
                logradouro: "Rua Gemeos",
                uf: "RJ",
                nome: "Teste da Silva",
                cpf: gerarCPF()
            }
        },
        ativacao: { dadosJornada: { txid: randomUUID().replace(/\-/g, '') } },
        calendario: {
            dataInicial: flatDate(new Date()).toJSON(),
            periodicidade: PeriodicidadeRecorrencia.Mensal
        },
        politicaRetentativa: PoliticaRetentativa.NaoPermite,
        recebedor: {
            cep: "26083190",
            cidade: "Nova Iguaçu",
            logradouro: "Rua Gemeos",
            uf: "RJ",
            nome: "Teste da Silva",
            cpf: gerarCPF()
        },
        valor: { valorRec: "1000.00" }
    };


    describe('/POST', () => {
        describe('400', () => {
            const detail = "A recorrência não respeita o schema."
            describe('vinculo', () => {
                it('objeto: length>35', async () => await expectPost400(app, `/rec`, { ...itm, vinculo: { ...itm.vinculo, objeto: "".padEnd(36, 'x') } }, detail, [{ razao: "O campo rec.vinculo.objeto não respeita o schema.", propriedade: "rec.vinculo.objeto" }]));
                it('objeto: empty', async () => await expectPost400(app, `/rec`, { ...itm, vinculo: { ...itm.vinculo, objeto: "" } }, detail, [{ razao: "O campo rec.vinculo.objeto não respeita o schema.", propriedade: "rec.vinculo.objeto" }]));

                it('contrato: length>35', async () => await expectPost400(app, `/rec`, { ...itm, vinculo: { ...itm.vinculo, contrato: "".padEnd(36, 'x') } }, detail, [{ razao: "O campo rec.vinculo.contrato não respeita o schema.", propriedade: "rec.vinculo.contrato" }]));
                it('contrato: empty', async () => await expectPost400(app, `/rec`, { ...itm, vinculo: { ...itm.vinculo, contrato: "" } }, detail, [{ razao: "O campo rec.vinculo.contrato não respeita o schema.", propriedade: "rec.vinculo.contrato" }]));

                it('devedor: empty', async () => await expectPost400(app, `/rec`, { ...itm, vinculo: { ...itm.vinculo, devedor: undefined } }, detail, [{ razao: "O objeto rec.vinculo.devedor não respeita o schema.", propriedade: "rec.vinculo.devedor" }]));

                it('devedor.nome: length>200', async () => await expectPost400(app, `/rec`, { ...itm, vinculo: { ...itm.vinculo, devedor: { ...itm.vinculo.devedor, nome: "".padEnd(201, 'x') } } }, detail, [{ razao: "O campo rec.vinculo.devedor.nome não respeita o schema.", propriedade: "rec.vinculo.devedor.nome" }]));
                it('devedor.nome: empty', async () => await expectPost400(app, `/rec`, { ...itm, vinculo: { ...itm.vinculo, devedor: { ...itm.vinculo.devedor, nome: '' } } }, detail, [{ razao: "O campo rec.vinculo.devedor.nome não respeita o schema.", propriedade: "rec.vinculo.devedor.nome" }]));

                it('devedor.cpf: invalid', async () => await expectPost400(app, `/rec`, { ...itm, vinculo: { ...itm.vinculo, devedor: { ...itm.vinculo.devedor, cpf: "1234567890" } } }, detail, [{ razao: "O campo rec.vinculo.devedor.cpf não respeita o schema.", propriedade: "rec.vinculo.devedor.cpf" }]));
                it('devedor.cnpj: invalid', async () => await expectPost400(app, `/rec`, { ...itm, vinculo: { ...itm.vinculo, devedor: { ...itm.vinculo.devedor, cnpj: "1234567890" } } }, detail, [{ razao: "O campo rec.vinculo.devedor.cnpj não respeita o schema.", propriedade: "rec.vinculo.devedor.cnpj" }]));
            })

            describe('calendario', () => {
                it('calendario: empty', async () => expectPost400(app, `/rec`, { ...itm, calendario: undefined }, detail, [{ razao: "O objeto rec.calendario não respeita o schema.", propriedade: "rec.calendario" }]));

                it('calendario.dataInicial: empty', async () => expectPost400(app, `/rec`, { ...itm, calendario: { ...itm.calendario, dataInicial: "" } }, detail, [{ razao: "O campo rec.calendario.dataInicial não respeita o schema.", propriedade: "rec.calendario.dataInicial" }]));
                it('calendario.dataInicial: invalid', async () => expectPost400(app, `/rec`, { ...itm, calendario: { ...itm.calendario, dataInicial: "abc1234" } }, detail, [{ razao: "O campo rec.calendario.dataInicial não respeita o schema.", propriedade: "rec.calendario.dataInicial" }]));

                it('calendario.datafinal: invalid', async () => expectPost400(app, `/rec`, { ...itm, calendario: { ...itm.calendario, dataFinal: "abc1234" } }, detail, [{ razao: "O campo rec.calendario.dataFinal não respeita o schema.", propriedade: "rec.calendario.dataFinal" }]));

                it('calendario.periodicidade: empty', async () => expectPost400(app, `/rec`, { ...itm, calendario: { ...itm.calendario, periodicidade: "" } }, detail, [{ razao: "O campo rec.calendario.periodicidade não respeita o schema.", propriedade: "rec.calendario.periodicidade" }]));
                it('calendario.periodicidade: invalid', async () => expectPost400(app, `/rec`, { ...itm, calendario: { ...itm.calendario, periodicidade: "abc1234" } }, detail, [{ razao: "O campo rec.calendario.periodicidade não respeita o schema.", propriedade: "rec.calendario.periodicidade" }]));

            })

            describe('valor', () => {
                it('valor: empty', async () => expectPost400(app, `/rec`, { ...itm, valor: undefined }, detail, [{ razao: "O objeto rec.valor não respeita o schema.", propriedade: "rec.valor" }]));
                //it('valor.valorRec: empty', async () => expectPost400(app, `/rec`, { ...itm, valor: {valorRec: undefined}  }, detail, [{ razao: "O campo rec.valor.valorRec não respeita o schema.", propriedade: "rec.valor.valorRec" }]));
                it('valor.valorRec: NaN', async () => expectPost400(app, `/rec`, { ...itm, valor: { valorRec: "abc123" } }, detail, [{ razao: "O campo rec.valor.valorRec não respeita o schema.", propriedade: "rec.valor.valorRec" }]));
            })

            describe('recebedor', () => {
                it('recebedor: empty', async () => expectPost400(app, `/rec`, { ...itm, recebedor: undefined }, detail, [{ razao: "O objeto rec.recebedor não respeita o schema.", propriedade: "rec.recebedor" }]));

                it('recebedor.nome: length>200', async () => expectPost400(app, `/rec`, { ...itm, recebedor: { ...itm.recebedor, nome: "".padEnd(201, 'x') } }, detail, [{ razao: "O campo rec.recebedor.nome não respeita o schema.", propriedade: "rec.recebedor.nome" }]));
                it('recebedor.nome: empty', async () => expectPost400(app, `/rec`, { ...itm, recebedor: { ...itm.recebedor, nome: '' } }, detail, [{ razao: "O campo rec.recebedor.nome não respeita o schema.", propriedade: "rec.recebedor.nome" }]));

                it('recebedor.cpf: invalid', async () => expectPost400(app, `/rec`, { ...itm, recebedor: { ...itm.recebedor, cpf: "1234567890" } }, detail, [{ razao: "O campo rec.recebedor.cpf não respeita o schema.", propriedade: "rec.recebedor.cpf" }]));
                it('recebedor.cnpj: invalid', async () => expectPost400(app, `/rec`, { ...itm, recebedor: { ...itm.recebedor, cnpj: "1234567890" } }, detail, [{ razao: "O campo rec.recebedor.cnpj não respeita o schema.", propriedade: "rec.recebedor.cnpj" }]));
            })
        });

        describe('401', () => {
            it('Sem Cabeçalho', () => expectPost401(app, '/rec', itm, true));
            it('Cabeçalho Inválido', () => expectPost401(app, '/rec', itm, false));
        });

        describe('201', () => {
            it('sucesso', async () => await expectPost201(app, `/rec`, itm, { valor: { valorRec: "1000.00" } }));

        })
    })

    describe('/GET {:idRec}', () => {
        it('200 com idRec no formato BACEN', async () => {
            const rec = await expectRequest(app, { method: 'post', endpoint: '/rec', status: 201, payload: buildRec(), expected: { status: 'CRIADA' } });
            expect(rec.idRec).toMatch(/^RN[0-9a-f]{8}\d{8}[0-9a-f]{11}$/);
            await expectRequest(app, { method: 'get', endpoint: `/rec/${rec.idRec}`, status: 200, expected: { idRec: rec.idRec, status: 'CRIADA', atualizacao: [{ status: 'CRIADA' }] } });
        });
        it('404', async () => expectRequest(app, { method: 'get', endpoint: '/rec/RN000000002020010100000000000', status: 404 }));
        it('401', async () => expectRequest(app, { method: 'get', endpoint: '/rec/qualquer', status: 401, token: 'xpto' }));
    })

    describe('/GET {:idRec}/ativacao', () => {
        it('200', async () => {
            const payload = buildRec();
            const { idRec } = await expectRequest(app, { method: 'post', endpoint: '/rec', status: 201, payload });
            await expectRequest(app, { method: 'get', endpoint: `/rec/${idRec}/ativacao`, status: 200, expected: { idRec, status: 'CRIADA', ativacao: { tipoJornada: 'JORNADA_3', dadosJornada: payload.ativacao.dadosJornada } } });
        });
        it('404', async () => expectRequest(app, { method: 'get', endpoint: '/rec/inexistente/ativacao', status: 404 }));
    })

    describe('/GET', () => {
        it('filtra por cpf do devedor e status', async () => {
            const payload = buildRec();
            const { idRec } = await expectRequest(app, { method: 'post', endpoint: '/rec', status: 201, payload });
            await expectRequest(app, { method: 'post', endpoint: '/rec', status: 201, payload: buildRec() });

            const { recs } = await expectRequest(app, { method: 'get', endpoint: '/rec', status: 200, query: { cpf: payload.vinculo.devedor.cpf, status: 'CRIADA' } });
            expect(recs.map((r) => r.idRec)).toEqual([idRec]);
            await expectRequest(app, { method: 'get', endpoint: '/rec', status: 200, query: { cpf: payload.vinculo.devedor.cpf, status: 'CANCELADA' }, expected: { recs: [] } });
        });
        it('filtra por período e pagina', async () => {
            await expectRequest(app, { method: 'post', endpoint: '/rec', status: 201, payload: buildRec() });
            await expectRequest(app, { method: 'get', endpoint: '/rec', status: 200, query: { inicio: '2000-01-01T00:00:00Z', fim: '2000-12-31T00:00:00Z' }, expected: { recs: [] } });
            await expectRequest(app, { method: 'get', endpoint: '/rec', status: 200, query: { 'paginacao.itensPorPagina': 1 }, expected: { parametros: { paginacao: { itensPorPagina: 1 } }, recs: [{}] } });
        });
        it('400 cpf inválido', async () => expectRequest(app, { method: 'get', endpoint: '/rec', status: 400, query: { cpf: '123' }, expected: { detail: 'A recorrência não respeita o schema.', violacoes: [{ propriedade: 'rec.cpf' }] } }));
    })

    describe('/PATCH', () => {
        const create = async () => (await expectRequest(app, { method: 'post', endpoint: '/rec', status: 201, payload: buildRec() })).idRec;

        it('200 cancela', async () => {
            const idRec = await create();
            await expectRequest(app, { method: 'patch', endpoint: `/rec/${idRec}`, status: 200, payload: { status: 'CANCELADA' }, expected: { status: 'CANCELADA', atualizacao: [{ status: 'CRIADA' }, { status: 'CANCELADA' }] } });
        });
        it('200 altera nome do devedor e dataInicial', async () => {
            const idRec = await create();
            const dataInicial = '2999-01-01';
            await expectRequest(app, { method: 'patch', endpoint: `/rec/${idRec}`, status: 200, payload: { vinculo: { devedor: { nome: 'Novo Nome' } }, calendario: { dataInicial } }, expected: { status: 'CRIADA', vinculo: { devedor: { nome: 'Novo Nome', cep: '26083190' } }, calendario: { dataInicial, periodicidade: 'MENSAL' } } });
        });
        it('400 status inválido', async () => {
            const idRec = await create();
            await expectRequest(app, { method: 'patch', endpoint: `/rec/${idRec}`, status: 400, payload: { status: 'APROVADA' }, expected: { detail: 'A recorrência não respeita o schema.', violacoes: [{ propriedade: 'rec.status', razao: 'O campo rec.status não respeita o schema.' }] } });
        });
        it('400 recorrência cancelada', async () => {
            const idRec = await create();
            await expectRequest(app, { method: 'patch', endpoint: `/rec/${idRec}`, status: 200, payload: { status: 'CANCELADA' } });
            await expectRequest(app, { method: 'patch', endpoint: `/rec/${idRec}`, status: 400, payload: { status: 'CANCELADA' }, expected: { violacoes: [{ propriedade: 'rec.status' }] } });
        });
        it('404', async () => expectRequest(app, { method: 'patch', endpoint: '/rec/inexistente', status: 404, payload: { status: 'CANCELADA' } }));
    })
})
