import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe, setupDatabase } from '../src/bootstrap';
import { correntistas } from '../src/data/db.json';
import { expectRequest } from './e2e';

describe('WEBHOOK', () => {
  let app: INestApplication;
  const [{ chave }, { chave: outraChave }] = correntistas;
  const webhookUrl = 'https://pix.example.com/api/webhook/';
  const detail = 'O webhook não respeita o schema.';

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

  describe('/PUT', () => {
    it('200 cria', async () =>
      expectRequest(app, {
        method: 'put',
        endpoint: `/webhook/${chave}`,
        status: 200,
        payload: { webhookUrl },
        expected: { webhookUrl, chave },
      }));

    it('200 atualiza preservando criacao', async () => {
      const { criacao } = await expectRequest(app, {
        method: 'put',
        endpoint: `/webhook/${chave}`,
        status: 200,
        payload: { webhookUrl },
      });
      await expectRequest(app, {
        method: 'put',
        endpoint: `/webhook/${chave}`,
        status: 200,
        payload: { webhookUrl: 'https://outro.example.com/hook' },
        expected: { webhookUrl: 'https://outro.example.com/hook', criacao },
      });
    });

    it('400 webhookUrl inválida', async () =>
      expectRequest(app, {
        method: 'put',
        endpoint: `/webhook/${chave}`,
        status: 400,
        payload: { webhookUrl: 'xpto' },
        expected: {
          type: 'https://pix.bcb.gov.br/api/v2/error/WebhookOperacaoInvalida',
          detail,
          violacoes: [
            {
              propriedade: 'webhook.webhookUrl',
              razao: 'O campo webhook.webhookUrl não respeita o schema.',
            },
          ],
        },
      }));

    it('400 webhookUrl ausente', async () =>
      expectRequest(app, {
        method: 'put',
        endpoint: `/webhook/${chave}`,
        status: 400,
        payload: {},
        expected: { violacoes: [{ propriedade: 'webhook.webhookUrl' }] },
      }));

    it('400 chave não pertence ao recebedor', async () =>
      expectRequest(app, {
        method: 'put',
        endpoint: '/webhook/chave-inexistente',
        status: 400,
        payload: { webhookUrl },
        expected: { violacoes: [{ propriedade: 'webhook.chave' }] },
      }));

    it('401', async () =>
      expectRequest(app, {
        method: 'put',
        endpoint: `/webhook/${chave}`,
        status: 401,
        payload: { webhookUrl },
        token: 'xpto',
      }));
  });

  describe('/GET', () => {
    it('200 :chave', async () => {
      await expectRequest(app, {
        method: 'put',
        endpoint: `/webhook/${chave}`,
        status: 200,
        payload: { webhookUrl },
      });
      await expectRequest(app, {
        method: 'get',
        endpoint: `/webhook/${chave}`,
        status: 200,
        expected: { webhookUrl, chave },
      });
    });

    it('404 :chave', async () =>
      expectRequest(app, {
        method: 'get',
        endpoint: '/webhook/chave-inexistente',
        status: 404,
      }));

    it('lista webhooks com Authorization Bearer', async () => {
      await expectRequest(app, {
        method: 'put',
        endpoint: `/webhook/${outraChave}`,
        status: 200,
        payload: { webhookUrl },
      });
      await request(app.getHttpServer())
        .get('/webhook')
        .query({ inicio: '2020-01-01T00:00:00Z', fim: '2999-01-01T00:00:00Z' })
        .set('Authorization', 'Bearer 123-abc')
        .expect(200)
        .expect((res) => {
          const body = JSON.parse(res.text);
          expect(body.parametros.paginacao).toMatchObject({
            paginaAtual: 0,
            itensPorPagina: 100,
          });
          expect(body.webhooks.map((w) => w.chave)).toEqual(
            expect.arrayContaining([chave, outraChave]),
          );
        });
    });

    it('isola webhooks por owner', async () => {
      await expectRequest(app, {
        method: 'put',
        endpoint: `/webhook/${chave}`,
        status: 200,
        payload: { webhookUrl },
      });
      await expectRequest(app, {
        method: 'get',
        endpoint: `/webhook/${chave}`,
        status: 404,
        token: '456-def',
      });
    });
  });

  describe('/DELETE', () => {
    it('204 e depois 404', async () => {
      await expectRequest(app, {
        method: 'put',
        endpoint: `/webhook/${chave}`,
        status: 200,
        payload: { webhookUrl },
      });
      await expectRequest(app, {
        method: 'delete',
        endpoint: `/webhook/${chave}`,
        status: 204,
      });
      await expectRequest(app, {
        method: 'get',
        endpoint: `/webhook/${chave}`,
        status: 404,
      });
      await expectRequest(app, {
        method: 'delete',
        endpoint: `/webhook/${chave}`,
        status: 404,
      });
    });
  });
});
