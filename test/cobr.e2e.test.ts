import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { createValidationPipe, setupDatabase } from '../src/bootstrap';
import { PoliticaRetentativa } from '../src/core/app/models/rec';
import { expectRequest } from './e2e';
import { buildRec, newTxid } from './fixtures';

describe('COBR', () => {
  let app: INestApplication;
  const detail = 'A cobrança não respeita o schema.';

  beforeAll(async () => {
    await setupDatabase();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterAll(async () => app.close());

  const createRec = (politica = PoliticaRetentativa.NaoPermite, cpf?: string) =>
    expectRequest(app, {
      method: 'post',
      endpoint: '/rec',
      status: 201,
      payload: buildRec(politica, cpf),
    });

  const cobrPayload = (idRec: string) => ({
    idRec,
    infoAdicional: 'Fatura mensal',
    calendario: { dataDeVencimento: '2999-01-01' },
    valor: { original: '100.00' },
    recebedor: { agencia: '0001', conta: '123456', tipoConta: 'CORRENTE' },
  });

  const createCobR = async (politica = PoliticaRetentativa.NaoPermite) => {
    const { idRec } = await createRec(politica);
    const txid = newTxid();
    await expectRequest(app, {
      method: 'put',
      endpoint: `/cobr/${txid}`,
      status: 200,
      payload: cobrPayload(idRec),
    });
    return { idRec, txid };
  };

  describe('/PUT', () => {
    it('200', async () => {
      const { idRec } = await createRec();
      const txid = newTxid();
      await expectRequest(app, {
        method: 'put',
        endpoint: `/cobr/${txid}`,
        status: 200,
        payload: cobrPayload(idRec),
        expected: {
          idRec,
          txid,
          status: 'CRIADA',
          ajusteDiaUtil: true,
          politicaRetentativa: 'NAO_PERMITE',
          valor: { original: '100.00' },
          calendario: { dataDeVencimento: '2999-01-01' },
          tentativas: [],
        },
      });
    });

    it('400 idRec inexistente', async () =>
      expectRequest(app, {
        method: 'put',
        endpoint: `/cobr/${newTxid()}`,
        status: 400,
        payload: cobrPayload('RNXXXX'),
        expected: {
          type: 'https://pix.bcb.gov.br/api/v2/error/CobROperacaoInvalida',
          detail,
          violacoes: [{ propriedade: 'cobr.idRec' }],
        },
      }));

    it('400 valor ausente', async () => {
      const { idRec } = await createRec();
      await expectRequest(app, {
        method: 'put',
        endpoint: `/cobr/${newTxid()}`,
        status: 400,
        payload: { ...cobrPayload(idRec), valor: undefined },
        expected: {
          detail,
          violacoes: [
            {
              propriedade: 'cobr.valor',
              razao: 'O objeto cobr.valor não respeita o schema.',
            },
          ],
        },
      });
    });

    it('400 txid em uso', async () => {
      const { idRec, txid } = await createCobR();
      await expectRequest(app, {
        method: 'put',
        endpoint: `/cobr/${txid}`,
        status: 400,
        payload: cobrPayload(idRec),
        expected: { violacoes: [{ propriedade: 'cobr.txid' }] },
      });
    });

    it('401', async () =>
      expectRequest(app, {
        method: 'put',
        endpoint: `/cobr/${newTxid()}`,
        status: 401,
        payload: {},
        token: 'xpto',
      }));
  });

  describe('/POST', () => {
    it('201 gera txid', async () => {
      const { idRec } = await createRec();
      const body = await expectRequest(app, {
        method: 'post',
        endpoint: '/cobr',
        status: 201,
        payload: cobrPayload(idRec),
        expected: { idRec, status: 'CRIADA' },
      });
      expect(body.txid).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe('/GET', () => {
    it('200 :txid', async () => {
      const { idRec, txid } = await createCobR();
      await expectRequest(app, {
        method: 'get',
        endpoint: `/cobr/${txid}`,
        status: 200,
        expected: { idRec, txid },
      });
    });

    it('404 :txid', async () =>
      expectRequest(app, {
        method: 'get',
        endpoint: `/cobr/${newTxid()}`,
        status: 404,
        expected: { status: 404 },
      }));

    it('lista filtrando por idRec e cpf do devedor', async () => {
      const cpf = buildRec().vinculo.devedor.cpf;
      const { idRec } = await createRec(PoliticaRetentativa.NaoPermite, cpf);
      const txid = newTxid();
      await expectRequest(app, {
        method: 'put',
        endpoint: `/cobr/${txid}`,
        status: 200,
        payload: cobrPayload(idRec),
      });
      await createCobR();

      const byRec = await expectRequest(app, {
        method: 'get',
        endpoint: '/cobr',
        status: 200,
        query: { idRec },
      });
      expect(byRec.cobsr.map((c) => c.txid)).toEqual([txid]);

      const byCpf = await expectRequest(app, {
        method: 'get',
        endpoint: '/cobr',
        status: 200,
        query: { cpf },
      });
      expect(byCpf.cobsr.map((c) => c.txid)).toEqual([txid]);
    });

    it('paginação', async () => {
      await createCobR();
      await createCobR();
      await expectRequest(app, {
        method: 'get',
        endpoint: '/cobr',
        status: 200,
        query: { 'paginacao.itensPorPagina': 1, 'paginacao.paginaAtual': 1 },
        expected: {
          parametros: { paginacao: { paginaAtual: 1, itensPorPagina: 1 } },
          cobsr: [{}],
        },
      });
    });
  });

  describe('/PATCH', () => {
    it('200 cancela', async () => {
      const { txid } = await createCobR();
      const body = await expectRequest(app, {
        method: 'patch',
        endpoint: `/cobr/${txid}`,
        status: 200,
        payload: { status: 'CANCELADA' },
        expected: { status: 'CANCELADA' },
      });
      expect(body.atualizacao.map((a) => a.status)).toEqual([
        'CRIADA',
        'CANCELADA',
      ]);
    });

    it('400 cobrança já cancelada', async () => {
      const { txid } = await createCobR();
      await expectRequest(app, {
        method: 'patch',
        endpoint: `/cobr/${txid}`,
        status: 200,
        payload: { status: 'CANCELADA' },
      });
      await expectRequest(app, {
        method: 'patch',
        endpoint: `/cobr/${txid}`,
        status: 400,
        payload: { status: 'CANCELADA' },
        expected: { violacoes: [{ propriedade: 'cobr.status' }] },
      });
    });

    it('400 status inválido', async () => {
      const { txid } = await createCobR();
      await expectRequest(app, {
        method: 'patch',
        endpoint: `/cobr/${txid}`,
        status: 400,
        payload: { status: 'CONCLUIDA' },
        expected: {
          violacoes: [
            {
              propriedade: 'cobr.status',
              razao: 'O campo cobr.status não respeita o schema.',
            },
          ],
        },
      });
    });

    it('404', async () =>
      expectRequest(app, {
        method: 'patch',
        endpoint: `/cobr/${newTxid()}`,
        status: 404,
        payload: { status: 'CANCELADA' },
      }));
  });

  describe('/POST :txid/retentativa/:data', () => {
    it('201 usa a data do path', async () => {
      const { txid } = await createCobR(PoliticaRetentativa.Permite);
      await expectRequest(app, {
        method: 'post',
        endpoint: `/cobr/${txid}/retentativa/2999-01-05`,
        status: 201,
        expected: {
          txid,
          tentativas: [
            {
              dataLiquidacao: '2999-01-05',
              tipo: 'NTAG',
              status: 'SOLICITADA',
            },
          ],
        },
      });
    });

    it('400 limite de 3 retentativas', async () => {
      const { txid } = await createCobR(PoliticaRetentativa.Permite);
      for (const dia of ['02', '03', '04']) {
        await expectRequest(app, {
          method: 'post',
          endpoint: `/cobr/${txid}/retentativa/2999-01-${dia}`,
          status: 201,
        });
      }
      await expectRequest(app, {
        method: 'post',
        endpoint: `/cobr/${txid}/retentativa/2999-01-05`,
        status: 400,
        expected: { violacoes: [{ propriedade: 'cobr.tentativas' }] },
      });
    });

    it('400 recorrência não permite retentativa', async () => {
      const { txid } = await createCobR(PoliticaRetentativa.NaoPermite);
      await expectRequest(app, {
        method: 'post',
        endpoint: `/cobr/${txid}/retentativa/2999-01-05`,
        status: 400,
        expected: { violacoes: [{ propriedade: 'cobr.politicaRetentativa' }] },
      });
    });

    it('400 data inválida', async () => {
      const { txid } = await createCobR(PoliticaRetentativa.Permite);
      await expectRequest(app, {
        method: 'post',
        endpoint: `/cobr/${txid}/retentativa/05-01-2999`,
        status: 400,
        expected: { violacoes: [{ propriedade: 'cobr.data' }] },
      });
    });

    it('404', async () =>
      expectRequest(app, {
        method: 'post',
        endpoint: `/cobr/${newTxid()}/retentativa/2999-01-05`,
        status: 404,
      }));
  });
});
