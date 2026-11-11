# Convenções NestJS do projeto

## Módulos

- Existem apenas dois módulos raiz, sem módulos de feature:
  - `AppModule` (`src/app.module.ts`): `controllers: [CobController, CobVController, LocationController, RecController]`, `providers: [PSP]`.
  - `AuthModule` (`src/auth.module.ts`): `controllers: [AuthController]`, `providers: [Auth]`.
- Um novo recurso Pix entra no `AppModule` (adicione o controller em `controllers`). Não crie um terceiro servidor sem discutir — a topologia dual-server (3000/3001) é contrato do projeto.

## Controllers (`src/controllers/<recurso>.controller.ts`)

- `@Controller('<recurso>')` com o nome exato do path BACEN (`cob`, `cobv`, `cobr`, `loc`, `rec`, `pix`, `webhook`).
- **Sempre** `@UseInterceptors(HttpInterceptor)` na classe — ele autentica (`Authorization: Bearer` ou `mocked-token` → `headers['IdOwner']`) e converte erros para o padrão BACEN.
- Leia o tenant com `@Headers() headers` e `const IdOwner = headers['IdOwner'];`.
- Controllers são finos: montam `PixRequest<T>` (`{ IdOwner, txid, data }`) e delegam ao `PSP`. Nenhuma regra de negócio no controller.
- `txid` gerado no servidor: `randomUUID().replace(/\-/g, '')`.
- Use o decorator HTTP correto para cada método (há `remove` legados anotados com `@Get`, o que conflita com a leitura — não replique).
- Retornar `undefined`/`null` em `GET`/`PATCH`/`DELETE` vira `404 NaoEncontrado` automaticamente via interceptor.

## Serviços

- Toda regra de negócio fica em `src/core/app/psp.ts` (`@Injectable() PSP`). Para um recurso novo, adicione métodos `add<Rec>`, `read<Rec>`, `list<Rec>`, `edit<Rec>`, `remove<Rec>` seguindo os existentes; extraia helpers privados com prefixo `_` quando compartilhados (`_addCob`, `_readCob`, `_listCob`).
- O `PSP` obtém as coleções no construtor com `MemoryDB.get('<NOME>')`. Toda coleção usada deve ser criada em `src/main.ts` **e** nos testes.
- Use `IdOwner` como `clusterKey` em todas as operações (isolamento por tenant). Dados globais (correntistas) usam o cluster `'DEV'`.
- Erros de negócio: `throw new Error(MESSAGES.Errors.defaults.<CHAVE>(...))` usando `src/libs/messages.ts`.

## DTOs e validação (`src/core/app/models/<recurso>.ts`)

- Classes (não interfaces) com decorators `class-validator`; objetos aninhados com `@ValidateNested()` + `@Type(() => Classe)`.
- Mensagens no formato BACEN com placeholder `$$`, que o interceptor troca por `<recurso>.<campo>`:
  - `'O campo $$ não respeita o schema.'`
  - `'O campo $$ é igual ou menor que zero.'` / `'O campo $$ é zero.'`
  - `'O objeto $$ não respeita o schema.'`
- Reaproveite validadores customizados de `src/validators/custom-validators.ts` (`@IsDICTValid`, `@IsDICTExists`, `@IsCPFValid`, `@IsCNPJValid`, `@NotPast`, `@MinStringNumber`, `@IsIDRec`) e tipos de `src/core/app/models.ts` (`Pessoa`, `PixID`, `Situacao`, `TipoCob`...).
- Documente propriedades com `@ApiProperty({ description, example })` de `@nestjs/swagger`.
- Valores monetários são `string` com pattern `\d{1,10}.\d{2}` (ex.: `"10.00"`).

## Interceptor e erros

- Ao criar um recurso novo, registre `[prefixo, detail]` dele em `BAD_REQUEST_TYPES` do `HttpInterceptor` (`src/http.interceptor.ts`); sem isso o 400 não sai no formato BACEN. Ex.: `'cob' → 'Cob'`, `'cobv' → 'CobV'`, `'cobr' → 'CobR'`, `'loc' → 'Location'`, `'rec' → 'Rec'`, `'pix' → 'Pix'`, `'webhook' → 'Webhook'`.
- Para listas, reutilize os helpers privados do `PSP` `_inPeriod` (filtro `inicio`/`fim`) e `_listResult` (paginação, aceita `paginacao[x]` e `paginacao.x`); booleanos de query via `parseBoolean` (`src/libs/utils.ts`).
- Tipos de erro seguem `https://pix.bcb.gov.br/api/v2/error/<Prefixo>OperacaoInvalida`, `AcessoNegado`, `NaoEncontrado`, `ServicoIndisponivel`.

## Swagger

- Configurações em `src/swagger-app.config.ts` e `src/swagger-auth.config.ts`; `SwaggerModule.setup('api-docs', ...)` em `main.ts`. Não altere o path `api-docs` (citado no README e usado pelos consumidores).
