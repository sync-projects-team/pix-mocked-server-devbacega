import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { createValidationPipe, setupDatabase } from '../src/bootstrap';
import { MemoryDB } from '../src/libs/fakedb';
import { TipoCob } from '../src/core/app/models';
import { correntistas } from '../src/data/db.json';

describe('Bootstrap (configuração do main.ts)', () => {
  let app: INestApplication;
  const token = '123-abc';
  const [correntista] = correntistas;

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

  const newTxid = () => randomUUID().replace(/-/g, '');

  it('cria todas as coleções usadas pelo PSP', () => {
    ['COB', 'COB_HIST', 'LOCATIONS', 'LOC_COB', 'REC', 'CORRENTISTAS'].forEach(
      (name) => expect(MemoryDB.get(name)).toBeDefined(),
    );
  });

  it('PUT /cob/:txid cria a cobrança', async () => {
    await request(app.getHttpServer())
      .put(`/cob/${newTxid()}`)
      .send({
        chave: correntista.chave,
        valor: { original: '1.00' },
        calendario: { expiracao: 3600 },
      })
      .set('mocked-token', token)
      .expect(200)
      .expect((res) =>
        expect(JSON.parse(res.text)).toMatchObject({
          revisao: 0,
          status: 'ATIVA',
        }),
      );
  });

  it('PUT /cob/:txid inválido retorna 400 no formato BACEN', async () => {
    await request(app.getHttpServer())
      .put(`/cob/${newTxid()}`)
      .send({
        chave: correntista.chave,
        valor: { original: '1.00' },
        calendario: { expiracao: 0 },
      })
      .set('mocked-token', token)
      .expect(400)
      .expect((res) =>
        expect(JSON.parse(res.text)).toMatchObject({
          status: 400,
          violacoes: [
            expect.objectContaining({
              propriedade: 'cob.calendario.expiracao',
            }),
          ],
        }),
      );
  });

  it('GET /cob filtra por cpf/cnpj do correntista', async () => {
    const inicio = new Date(Date.now() - 60000).toISOString();
    const fim = new Date(Date.now() + 60000).toISOString();
    const doc = correntista.cpfcnpj.length === 11 ? 'cpf' : 'cnpj';

    await request(app.getHttpServer())
      .get('/cob')
      .query({ inicio, fim, [doc]: correntista.cpfcnpj })
      .set('mocked-token', token)
      .expect(200);
  });

  it('DELETE /cob/:txid remove a cobrança', async () => {
    const txid = newTxid();
    const server = app.getHttpServer();

    await request(server)
      .put(`/cob/${txid}`)
      .send({ chave: correntista.chave, valor: { original: '2.00' } })
      .set('mocked-token', token)
      .expect(200);

    await request(server)
      .delete(`/cob/${txid}`)
      .set('mocked-token', token)
      .expect(200);
    await request(server)
      .get(`/cob/${txid}`)
      .set('mocked-token', token)
      .expect(404);
  });

  it('PUT /loc cria a location', async () => {
    await request(app.getHttpServer())
      .put('/loc')
      .send({ tipoCob: TipoCob.imediato })
      .set('mocked-token', token)
      .expect(200)
      .expect((res) =>
        expect(JSON.parse(res.text)).toMatchObject({
          tipoCob: TipoCob.imediato,
        }),
      );
  });
});
