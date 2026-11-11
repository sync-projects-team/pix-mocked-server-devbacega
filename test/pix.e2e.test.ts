import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { createValidationPipe, setupDatabase } from '../src/bootstrap';
import { correntistas } from '../src/data/db.json';
import { gerarCPF } from '../src/libs/documentos';
import { expectRequest } from './e2e';
import { newTxid } from './fixtures';

describe('PIX', () => {
  let app: INestApplication;
  const [{ chave }] = correntistas;
  const E2EID = /^E[0-9a-f]{8}\d{12}[0-9a-f]{11}$/;

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

  const pagarCob = async (cpf = gerarCPF()) => {
    const txid = newTxid();
    await expectRequest(app, {
      method: 'put',
      endpoint: `/cob/${txid}`,
      status: 200,
      payload: {
        chave,
        valor: { original: '15.00' },
        devedor: { nome: 'Pagador da Silva', cpf },
        solicitacaoPagador: 'Pedido 123',
      },
    });
    await expectRequest(app, {
      method: 'patch',
      endpoint: `/cob/${txid}`,
      status: 200,
      payload: { status: 'CONCLUIDA' },
      expected: { status: 'CONCLUIDA' },
    });
    const { pix } = await expectRequest(app, {
      method: 'get',
      endpoint: '/pix',
      status: 200,
      query: { txid },
    });
    return { txid, cpf, pix: pix[0] };
  };

  it('registra o Pix recebido quando a cob fica CONCLUIDA', async () => {
    const { txid, cpf, pix } = await pagarCob();
    expect(pix).toMatchObject({
      txid,
      chave,
      valor: '15.00',
      infoPagador: 'Pedido 123',
      pagador: { nome: 'Pagador da Silva', cpf },
      devolucoes: [],
    });
    expect(pix.endToEndId).toMatch(E2EID);
    expect(pix.e2eid).toBeUndefined();
  });

  it('não registra Pix para cob ATIVA', async () => {
    const txid = newTxid();
    await expectRequest(app, {
      method: 'put',
      endpoint: `/cob/${txid}`,
      status: 200,
      payload: { chave, valor: { original: '1.00' } },
    });
    await expectRequest(app, {
      method: 'get',
      endpoint: '/pix',
      status: 200,
      query: { txid },
      expected: { pix: [] },
    });
  });

  it('registra o Pix quando a cobv fica CONCLUIDA', async () => {
    const txid = newTxid();
    await expectRequest(app, {
      method: 'put',
      endpoint: `/cobv/${txid}`,
      status: 200,
      payload: {
        chave,
        valor: {
          original: '20.00',
          abatimento: { modalidade: 1, valorPerc: '2.00' },
        },
        calendario: {
          dataDeVencimento: new Date().toJSON(),
          validadeAposVencimento: 1,
        },
      },
      expected: { valor: { abatimento: { modalidade: 1, valorPerc: '2.00' } } },
    });
    await expectRequest(app, {
      method: 'patch',
      endpoint: `/cobv/${txid}`,
      status: 200,
      payload: { status: 'CONCLUIDA' },
      expected: { valor: { abatimento: { valorPerc: '2.00' } } },
    });
    await expectRequest(app, {
      method: 'get',
      endpoint: '/pix',
      status: 200,
      query: { txid },
      expected: { pix: [{ txid, valor: '20.00' }] },
    });
  });

  describe('/GET :e2eid', () => {
    it('200', async () => {
      const { pix } = await pagarCob();
      await expectRequest(app, {
        method: 'get',
        endpoint: `/pix/${pix.endToEndId}`,
        status: 200,
        expected: pix,
      });
    });

    it('404', async () =>
      expectRequest(app, {
        method: 'get',
        endpoint: '/pix/E00000000202001010000xxxxxxxxxxx',
        status: 404,
        expected: { status: 404 },
      }));

    it('401', async () =>
      expectRequest(app, {
        method: 'get',
        endpoint: '/pix/qualquer',
        status: 401,
        token: 'xpto',
      }));
  });

  describe('/GET', () => {
    it('filtra por cpf do pagador', async () => {
      const { txid, cpf } = await pagarCob();
      await pagarCob();
      const { pix } = await expectRequest(app, {
        method: 'get',
        endpoint: '/pix',
        status: 200,
        query: { cpf },
      });
      expect(pix.map((p) => p.txid)).toEqual([txid]);
    });

    it('filtra por txIdPresente e devolucaoPresente', async () => {
      await pagarCob();
      await expectRequest(app, {
        method: 'get',
        endpoint: '/pix',
        status: 200,
        query: { txIdPresente: false },
        expected: { pix: [], parametros: { txIdPresente: false } },
      });
      await expectRequest(app, {
        method: 'get',
        endpoint: '/pix',
        status: 200,
        query: { devolucaoPresente: true },
        expected: { pix: [] },
      });
      const { pix } = await expectRequest(app, {
        method: 'get',
        endpoint: '/pix',
        status: 200,
        query: { txIdPresente: true, devolucaoPresente: false },
      });
      expect(pix.length).toBeGreaterThan(0);
    });

    it('filtra por período', async () => {
      await pagarCob();
      await expectRequest(app, {
        method: 'get',
        endpoint: '/pix',
        status: 200,
        query: { inicio: '2000-01-01T00:00:00Z', fim: '2000-12-31T00:00:00Z' },
        expected: { pix: [] },
      });
    });

    it('400 cpf inválido', async () =>
      expectRequest(app, {
        method: 'get',
        endpoint: '/pix',
        status: 400,
        query: { cpf: '123' },
        expected: {
          type: 'https://pix.bcb.gov.br/api/v2/error/PixOperacaoInvalida',
          detail: 'O Pix não respeita o schema.',
          violacoes: [{ propriedade: 'pix.cpf' }],
        },
      }));
  });
});
