# Padrões de testes

Configuração: `jest.config.ts` (preset `ts-jest`, `clearMocks: true`, `collectCoverage: true`, `coverageDirectory: coverage`, `coverageProvider: v8`). O Jest usa o `testMatch` padrão, logo qualquer `*.test.ts` em `test/` é executado por `npm test`.

## Organização

| Pasta / arquivo | Tipo | O que exercita |
| --- | --- | --- |
| `test/<recurso>.e2e.test.ts` | e2e HTTP | `AppModule` completo via `supertest` (`cob`, `cobv`, `location`, `rec`) |
| `test/controllers/<recurso>.controller.test.ts` | integração | controller + `PSP` via `Test.createTestingModule`, chamando métodos diretamente |
| `test/core/app/*.test.ts` | unitário | `MemoryDB` (`fakedb.test.ts`), `PSP` (`psp.test.ts`), `utils` |
| `test/core/auth/auth.e2e.test.ts` | e2e HTTP | `AuthModule` (`POST /auth`) |
| `test/libs/`, `test/validators/` | unitário | `messages.ts` e validadores customizados |
| `test/e2e.ts` | helper | `expectPost200`, `expectPost201`, `expectPost400`, `expectPost401` |

Novos testes devem seguir a mesma árvore espelhando `src/`.

## Regras obrigatórias

1. **Crie as coleções do `MemoryDB` no `beforeAll`** do arquivo, pois `main.ts` não é executado nos testes. Para replicar exatamente o servidor real, use `await setupDatabase()` e `app.useGlobalPipes(createValidationPipe())` de `src/bootstrap.ts` (ver `test/bootstrap.e2e.test.ts`). Setup manual equivalente:
   ```ts
   const cst = MemoryDB.create('CORRENTISTAS', ['chave', 'cpfcnpj']);
   MemoryDB.create('COB', ['txid']);
   MemoryDB.create('COB_HIST', ['id']);
   MemoryDB.create('LOCATIONS', ['id', 'uuid']);
   MemoryDB.create('LOC_COB', ['id', 'txid']);
   await Promise.all(correntistas.map((c) => cst.add('DEV', c)));
   ```
   O registro de coleções é estático: criar a mesma coleção duas vezes no mesmo arquivo lança `Duplicate Collection`. Cada arquivo roda em um worker/módulo isolado, então pode repetir o setup.
2. **Replique o `ValidationPipe` dos testes e2e** (é ele que produz `violacoes` no formato BACEN):
   ```ts
   app.useGlobalPipes(new ValidationPipe({
     disableErrorMessages: false,
     transform: true,
     skipMissingProperties: true,
     exceptionFactory: (errors) => { throw new BadRequestException(errorFormatter(errors)); },
   }));
   ```
   (`errorFormatter` vem de `src/libs/utils.ts`.)
3. **Autenticação**: toda requisição à API principal precisa de `.set('mocked-token', '123-abc')` (ou outro token de `db.json.owners`). Teste o 401 sem header e com token inválido (`'xpto'`).
4. **Dados**: use `randomUUID()` para `IdOwner`/`txid`, `correntistas[i].chave` para chaves válidas, `gerarCPF()`/`gerarCNPJ()` (`src/libs/documentos.ts`) para documentos válidos e chaves inexistentes, `addDays`/`flatDate` (`src/libs/utils.ts`) para datas.
5. **Asserções de erro** validam o payload BACEN com `toMatchObject`:
   ```ts
   .expect(400)
   .expect((res) => expect(JSON.parse(res.text)).toMatchObject({
     status: 400,
     detail: 'A cobrança não respeita o schema.',
     violacoes: [{ razao: 'O campo cob.valor.original é zero.', propriedade: 'cob.valor.original' }],
   }));
   ```
   O nome do `it(...)` costuma ser a própria mensagem esperada.
6. **Estrutura de `describe`**: `describe('<RECURSO>')` → `describe('/<VERBO>')` → `describe('<status>')` → `it('<cenário>')`.
7. Testes que chamam `Auth.validate` levam ~2 s cada; `PSP.addLoc` tem 100 ms de delay. Evite loops grandes que criem locations.

## Execução

```bash
npm test                                   # suíte completa (~50 s, 266 testes)
npx jest test/rec.e2e.test.ts --coverage=false
npx jest -t 'Sem cabeçalho'
```

Um PR só está pronto quando `npm run build` e `npm test` passam.
