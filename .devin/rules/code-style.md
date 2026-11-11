# Regras de estilo de código

Fonte da verdade: `.eslintrc.js`, `.prettierrc`, `tsconfig.json`.

## Prettier (`.prettierrc`)

- `singleQuote: true` → strings com aspas simples (`'cob'`), exceto quando contêm aspas simples.
- `trailingComma: "all"` → vírgula final em objetos, arrays, parâmetros e argumentos multilinha.
- Demais opções no padrão do Prettier 3: indentação de 2 espaços, `printWidth` 80, ponto e vírgula obrigatório.

## ESLint (`.eslintrc.js`)

- Parser `@typescript-eslint/parser` com `project: tsconfig.json`.
- Extends: `plugin:@typescript-eslint/recommended` + `plugin:prettier/recommended` (violações de Prettier são erros de lint).
- Regras desligadas: `interface-name-prefix`, `explicit-function-return-type`, `explicit-module-boundary-types`, `no-explicit-any` → tipos de retorno explícitos e `any` são permitidos.
- Ambientes: `node` e `jest`.

## Como aplicar sem poluir o diff

O código legado **não está formatado** (≈2.9k erros de ESLint, majoritariamente Prettier: aspas duplas, 4 espaços). Portanto:

- **Não** rode `npm run lint` nem `npm run format` no repositório inteiro em PRs de feature — ambos reescrevem todos os arquivos.
- Formate apenas os arquivos que você criou/alterou:
  ```bash
  npx prettier --write src/caminho/arquivo.ts test/caminho/arquivo.test.ts
  npx eslint src/caminho/arquivo.ts
  ```
- Ao editar um arquivo legado de forma pontual, preserve o estilo existente das linhas vizinhas para manter o diff pequeno; reformatar o arquivo inteiro deve ser um PR separado.

## TypeScript (`tsconfig.json`)

- `target: ES2021`, `module: commonjs`, `experimentalDecorators` + `emitDecoratorMetadata` (necessários para Nest/class-validator).
- `resolveJsonModule: true` → seeds são importados diretamente: `import { owners } from '../../data/db.json'`.
- `strictNullChecks: false` e `noImplicitAny: false`: o compilador não protege contra `undefined`; trate ausência explicitamente (o interceptor transforma retorno `undefined`/`null` em 404).

## Convenções de nomenclatura observadas

- Arquivos: `kebab`/`dot` case — `cob.controller.ts`, `auth.models.ts`, `custom-validators.ts`.
- Classes: `PascalCase` com prefixo do recurso — `CobController`, `CobVPutRequest`, `LocGetFilter`, `RecPostRequest`.
- DTOs: `<Recurso><Verbo><Request|Response|Filter>` (`CobPatchRequest`, `CobVGetResponse`).
- Enums em `PascalCase` com valores no formato BACEN (`Situacao.Ativa = "ATIVA"`, `TipoCob.imediato = "cob"`).
- Domínio, mensagens e comentários em **português**; identificadores técnicos podem ser em inglês (`add`, `read`, `list`, `edit`, `remove`).
- `txid` gerado com `randomUUID().replace(/\-/g, '')` (32 caracteres hex).

## Imports

- Prefira caminhos relativos a partir do arquivo (`../core/app/psp`). Nunca use o padrão `../../src/...` (usado hoje em `location.controller.ts`): ele quebra o `docker build`, que copia `src/` achatado.
- `MemoryDB` sempre de `src/libs/fakedb` (ignore a cópia `src/controllers/fakedb.ts`).
