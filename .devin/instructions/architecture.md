# Arquitetura do PIX Mocked Server

> Documento de análise arquitetural gerado a partir da leitura do código (`src/`, `test/`, `package.json`, `dockerfile`, `.devcontainer/`, `jest.config.ts`).
> Sempre que o código mudar, atualize este arquivo junto com a mudança.

## 1. Propósito

O projeto (`package.json` → `psp-api`) é um **mock da API Pix do Banco Central do Brasil (BACEN)**, seguindo o swagger oficial em <https://bacen.github.io/pix-api/>.
Seu objetivo é permitir **desenvolvimento e testes locais de integrações Pix sem depender das sandboxes dos bancos/PSPs** (que costumam ser instáveis ou incompletas). Ele simula:

- o fluxo de autenticação OAuth2 `client_credentials` de um PSP;
- os recursos de cobrança (`cob`, `cobv`, `cobr`), locations (`loc`) e recorrências (`rec`);
- o formato de erro padronizado do BACEN (`https://pix.bcb.gov.br/api/v2/error/...`) com `violacoes`.

Não há banco de dados nem integração externa: tudo vive em memória e é perdido ao reiniciar o processo.

## 2. Stack

| Item | Versão / Ferramenta |
| --- | --- |
| Runtime | Node.js 20 (`dockerfile`, `.devcontainer/devcontainer.json`) |
| Framework | NestJS 10 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`) |
| Linguagem | TypeScript 5 (`target: ES2021`, `module: commonjs`, `strictNullChecks: false`, `noImplicitAny: false`) |
| Validação | `class-validator` + `class-transformer` + validadores customizados em `src/validators/custom-validators.ts` |
| Documentação | `@nestjs/swagger` 7 (Swagger UI em `/api-docs` nos dois servidores) |
| Testes | Jest 29 + `ts-jest` + `supertest` + `@nestjs/testing` |
| Qualidade | ESLint 8 (`@typescript-eslint` + `plugin:prettier/recommended`) e Prettier 3 |

## 3. Topologia dual-server

`src/main.ts` sobe **duas aplicações Nest independentes no mesmo processo Node**:

```mermaid
flowchart LR
    Client[Cliente / Postman / Sistema integrador]

    subgraph Processo Node - src/main.ts
        direction TB
        Seed[(MemoryDB<br/>COB, LOCATIONS, CORRENTISTAS<br/>seed: src/data/db.json)]

        subgraph Auth[AuthModule :3001]
            AuthCtrl[AuthController<br/>POST /auth]
            AuthSvc[Auth service]
            AuthCtrl --> AuthSvc
        end

        subgraph App[AppModule :3000]
            Interceptor[HttpInterceptor<br/>valida header mocked-token<br/>formata erros BACEN]
            Ctrls[CobController /cob<br/>CobVController /cobv<br/>LocationController /loc<br/>RecController /rec]
            PSP[PSP service<br/>regras de negócio]
            Interceptor --> Ctrls --> PSP
        end

        PSP --> Seed
    end

    Client -- "1. POST /auth (client_id, client_secret)" --> AuthCtrl
    AuthCtrl -- "accesstoken = client_id-client_secret" --> Client
    Client -- "2. Header mocked-token: accesstoken" --> Interceptor
```

| Servidor | Porta | Módulo | Swagger | Config Swagger |
| --- | --- | --- | --- | --- |
| API Principal | `3000` | `AppModule` (`src/app.module.ts`) | <http://localhost:3000/api-docs> | `src/swagger-app.config.ts` |
| Serviço de Autenticação | `3001` | `AuthModule` (`src/auth.module.ts`) | <http://localhost:3001/api-docs> | `src/swagger-auth.config.ts` |

Ordem de bootstrap em `src/main.ts`:

1. Cria as coleções `COB` (sortKey `txid`), `LOCATIONS` (`id`, `uuid`) e `CORRENTISTAS` (`chave`) no `MemoryDB`.
2. Popula `CORRENTISTAS` no cluster `"DEV"` com `correntistas` de `src/data/db.json`.
3. Cria o `AppModule`, registra `ValidationPipe` global, publica Swagger e escuta em `3000`.
4. Cria o `AuthModule`, publica Swagger e escuta em `3001`.

## 4. Módulos e camadas

```
src/
├── main.ts                    # bootstrap dos 2 servidores + seed do MemoryDB
├── app.module.ts              # AppModule: CobController, CobVController, LocationController, RecController + PSP
├── auth.module.ts             # AuthModule: AuthController + Auth
├── http.interceptor.ts        # autenticação por header e tradução de erros para o padrão BACEN
├── swagger-app.config.ts      # DocumentBuilder da API principal (bearer "access-token")
├── swagger-auth.config.ts     # DocumentBuilder do auth (oauth2 clientCredentials, tokenUrl /auth)
├── controllers/               # camada HTTP (rotas Nest)
│   ├── auth.controller.ts / auth.models.ts
│   ├── cob.controller.ts      # /cob
│   ├── cobv.controller.ts     # /cobv
│   ├── cobr.controller.ts     # /cobr  (NÃO registrado no AppModule)
│   ├── location.controller.ts # /loc
│   ├── rec.controller.ts      # /rec
│   ├── webhook.controller.ts  # vazio (webhooks ainda não implementados)
│   └── fakedb.ts              # cópia legada de libs/fakedb.ts (não usada pelos módulos)
├── core/
│   ├── app/psp.ts             # serviço PSP: regras de cob/cobv/loc/rec
│   ├── app/models.ts          # tipos/enum compartilhados (PixID, PixKey, TipoCob, Situacao, Pessoa...)
│   ├── app/models/{cob,cobv,cobr,loc,rec}.ts  # DTOs com decorators class-validator
│   └── auth/auth.ts           # serviço Auth (valida client_id/secret contra owners)
├── libs/
│   ├── fakedb.ts              # MemoryDB
│   ├── messages.ts            # VALIDATORS (regex) e MESSAGES (textos de erro)
│   ├── documentos.ts          # gerar/validar CPF e CNPJ
│   └── utils.ts               # QRCode/CRC, datas (addDays, flatDate), getMD5Hash, errorFormatter
├── validators/custom-validators.ts  # @IsDICTValid, @IsDICTExists, @IsCPFValid, @IsCNPJValid, @NotPast, @MinStringNumber, @IsIDRec...
└── data/
    ├── db.json                # seed: owners (credenciais) e correntistas (chaves DICT)
    └── municipios.json        # tabela UF/município IBGE
```

Fluxo de uma requisição na API principal:

1. `HttpInterceptor` (aplicado via `@UseInterceptors` em cada controller) lê o header **`mocked-token`**, procura o owner em `db.json.owners` e injeta `headers['IdOwner'] = owner.id`. Sem token válido → `401 AcessoNegado`.
2. `ValidationPipe` valida o DTO (`CobPutRequest`, `LocPutRequest`, `RecPostRequest` ...). As mensagens usam o placeholder `$$`, que o interceptor substitui por `<recurso>.<campo>` (ex.: `cob.valor.original`).
3. O controller monta um `PixRequest<T>` (`{ IdOwner, txid, data }`) e delega ao `PSP`.
4. O `PSP` lê/grava no `MemoryDB`, usando **`IdOwner` como clusterKey** (isolamento multi-tenant).
5. O interceptor converte respostas vazias de `GET/PATCH/DELETE` em `404 NaoEncontrado` e erros em payloads no padrão BACEN (`type`, `title`, `status`, `detail`, `violacoes`).

## 5. Recursos Pix implementados

| Recurso | Rota | Métodos expostos | Situação |
| --- | --- | --- | --- |
| Cobrança imediata (`cob`) | `/cob` | `PUT /cob/:txid`, `POST /cob` (txid gerado), `GET /cob/:txid[?revisao=n]`, `GET /cob` (filtro `inicio`, `fim`, `cpf`/`cnpj`, `locationPresente`, `paginacao`), `PATCH /cob/:txid` | Implementado. Cria location automaticamente, versiona revisões em `COB_HIST`, `calendario.expiracao` padrão 86400s. |
| Cobrança com vencimento (`cobv`) | `/cobv` | `PUT /cobv/:txid`, `GET /cobv/:txid`, `GET /cobv`, `PATCH /cobv/:txid` | Implementado (`valor.multa`, `valor.juros`, `valor.desconto`; abatimento ainda não). `calendario.dataDeVencimento` não pode ser passada (`@NotPast`). Persiste na mesma coleção `COB`. |
| Cobrança recorrente (`cobr`) | `/cobr` | Controller existe (`PUT`, `POST`, `POST /:txid/retentativa/:data`, `GET`, `PATCH`) | **Parcial**: `PSP.addCobR` retorna `null` e `CobRController` não está em `AppModule` → rotas não expostas. |
| Location (`loc`) | `/loc` | `PUT /loc` (body `{ tipoCob: "cob" \| "cobv" }`), `GET /loc/:id`, `GET /loc` (filtro `tipoCob`, `txIdPresente`), `DELETE /loc/:id/txid` (desvincula cobrança) | Implementado. `location` = `pix.example.com/qr/<uuid>`. |
| Recorrência (`rec`) | `/rec` | `POST /rec` | Implementado (criação). `idRec` = `R` + (`N`\|`R` conforme `politicaRetentativa`) + `ISPB` do owner + `YYYYMMDD`. |
| Webhooks | — | — | **Não implementado** (`webhook.controller.ts` vazio). |
| Autenticação | `:3001/auth` | `POST /auth` | Implementado (ver seção 6). |

> Os métodos `remove` de `cob`/`cobv`/`cobr` estão decorados com `@Get(':txid')` (duplicando a rota de leitura), portanto **não há rota `DELETE`** exposta para cobranças.

## 6. Autenticação OAuth2 mockada

- Endpoint: `POST http://localhost:3001/auth` com body JSON `{ "grant_type": "client_credentials", "client_id": "...", "client_secret": "..." }` (`ValidateInput` em `src/controllers/auth.models.ts`).
- `Auth.validate` (`src/core/auth/auth.ts`) espera **2 s** (simula latência) e monta o token como `` `${client_id}-${client_secret}` ``; se existir em `db.json.owners[].token` retorna, senão rejeita.
- Resposta (HTTP 201): `{ "accesstoken": "123-abc", "expires_in": 300 }`. Não há expiração real.
- Na API principal o token é enviado no header **`mocked-token`** (não em `Authorization: Bearer`, apesar do Swagger declarar `access-token` bearer).

Credenciais disponíveis (`src/data/db.json` → `owners`):

| client_id | client_secret | mocked-token | ISPB |
| --- | --- | --- | --- |
| `123` | `abc` | `123-abc` | `0d9094da` |
| `456` | `def` | `456-def` | `4aa5cce5` |
| `789` | `ghi` | `789-ghi` | `84dc48b6` |
| `012` | `fab` | `012-fab` | — |
| `345` | `cde` | `345-cde` | — |

> Owners sem `ISPB` geram `idRec` inválido em `POST /rec`.

## 7. Persistência em memória (`MemoryDB`) e seed

`src/libs/fakedb.ts` implementa um "banco" estático em memória:

- `MemoryDB.create(nome, sortKeys)` registra uma coleção global (erro `Duplicate Collection` se repetida; `Sort Key Required` se `sortKeys` vazio). `MemoryDB.get(nome)` recupera.
- Cada coleção é particionada por **clusterKey** (na prática, o `IdOwner` do tenant; `"DEV"` para correntistas).
- Operações assíncronas: `add` (valida sortKey, `Duplicate Key`), `read(cluster, {sortKey: valor})`, `patch` (merge), `update` (substituição), `list` (ordena pelo 1º sortKey), `remove`.

Coleções usadas pelo `PSP`:

| Coleção | SortKeys | Uso | Criada em `main.ts`? |
| --- | --- | --- | --- |
| `CORRENTISTAS` | `chave` (testes também usam `cpfcnpj`) | chaves DICT válidas (seed `db.json.correntistas`) | Sim |
| `COB` | `txid` | cobranças `cob` e `cobv` | Sim |
| `LOCATIONS` | `id`, `uuid` | locations; `id = Date.now()` (com delay de 100 ms para evitar colisão) | Sim |
| `LOC_COB` | `id`, `txid` | vínculo location ↔ cobrança | **Não** |
| `COB_HIST` | `id` (`md5(txid, revisao)`) | histórico de revisões | **Não** |
| `COBV`, `COBR` | `txid` | reservadas (não usadas efetivamente) | **Não** |
| `REC` | `idRec` | recorrências | **Não** |

Seed (`src/data/db.json`): 5 `owners` (credenciais/tenants) e 3 `correntistas` (chaves aleatórias DICT com CPF/CNPJ, nome e cidade). As cobranças só aceitam `chave` presente em `CORRENTISTAS` (`@IsDICTExists`).

## 8. Swagger

- `SwaggerModule.setup('api-docs', ...)` em ambos os servidores.
- API principal: título "PIX Mocked Server - API Principal", link para a doc oficial, esquema bearer `access-token`, servidor `http://localhost:3000`.
- Auth: título "PIX Mocked Server - Autenticação", esquema `oauth2` `clientCredentials` com `tokenUrl: /auth`, servidor `http://localhost:3001`.
- DTOs documentados via `@ApiProperty` (ex.: `auth.models.ts`, `models/cob.ts`).

## 9. Como rodar e testar

Resumo (detalhes em [`setup.md`](./setup.md)):

```bash
npm ci
npm run start:dev          # watch mode, sobe :3000 e :3001
npm run build              # gera dist/ (ver observação abaixo)
npm test                   # Jest com cobertura (260 testes em 15 suites)
docker build -t pix-mocked-server . && docker run -p 3000:3000 -p 3001:3001 pix-mocked-server   # hoje falha, ver §10 item 7
```

Testes (`jest.config.ts`, preset `ts-jest`, `collectCoverage: true`, saída em `coverage/`):

- `test/*.e2e.test.ts` — sobem `AppModule` com `supertest` (cob, cobv, loc, rec).
- `test/controllers/*.test.ts` — instanciam controllers + `PSP` via `Test.createTestingModule`.
- `test/core/**`, `test/libs/**`, `test/validators/**` — unitários de `MemoryDB`, `PSP`, utils, mensagens e validadores.
- `test/e2e.ts` — helpers `expectPost200/201/400/401` (usam `mocked-token: 123-abc`).

## 10. Limitações e pontos de atenção conhecidos

Verificados durante a análise (comportamento atual de `main`):

1. **Coleções faltando no bootstrap**: `main.ts` não cria `LOC_COB`, `COB_HIST` e `REC`. Com o servidor real, `PUT /cob/:txid` e `PUT /loc` retornam `500` (`Cannot read properties of undefined (reading 'read')`) e `POST /rec` também falha. Os testes não detectam porque cada suíte cria suas próprias coleções.
2. **`ValidationPipe` diferente entre testes e produção**: os testes usam `transform: true`, `skipMissingProperties: true` e `exceptionFactory` com `errorFormatter` (`src/libs/utils.ts`); `main.ts` usa `new ValidationPipe()` padrão, então o formato de `violacoes` pode divergir em runtime.
3. **`npm run start:prod` aponta para `dist/main`**, mas como `jest.config.ts` está na raiz e é incluído na compilação, o build gera `dist/src/main.js`. Use `node dist/src/main.js` localmente. No Docker o `src/` é copiado "achatado" para `/app`, então lá o artefato é `dist/main.js`.
4. **`npm run test:e2e`** usa `test/jest-e2e.json` com `testRegex: .e2e-spec.ts$`, que não casa com nenhum arquivo (os e2e se chamam `*.e2e.test.ts` e rodam em `npm test`).
5. **`cobr` e webhooks** incompletos; rotas `DELETE` de cobranças inexistentes (ver seção 5).
6. **Lint**: o código atual não segue o Prettier (≈2.9k erros de `eslint` sem `--fix`). `npm run lint` usa `--fix` e reformataria o repositório inteiro — rode apenas nos arquivos alterados.
7. **Build Docker quebrado**: `docker build` falha com `TS2307` em `src/controllers/location.controller.ts`, que importa `../../src/core/app/models/loc`, `../../src/core/app/psp` e `../../src/http.interceptor`. No container `src/` é copiado achatado para `/app`, então esses caminhos não existem. Usar `../core/app/models/loc`, `../core/app/psp` e `../http.interceptor` corrige.
8. `src/controllers/fakedb.ts` é uma cópia de `src/libs/fakedb.ts` não utilizada; sempre importe de `src/libs/fakedb`.
