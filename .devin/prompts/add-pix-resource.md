# Prompt: adicionar (ou completar) um recurso Pix

Substitua `{{RECURSO}}` (path BACEN, ex.: `cobr`, `webhook`, `pix`, `lotecobv`), `{{Recurso}}` (PascalCase, ex.: `CobR`) e `{{COLECAO}}` (ex.: `COBR`).

---

Implemente o recurso `/{{RECURSO}}` no PIX Mocked Server seguindo a especificação https://bacen.github.io/pix-api/ e as convenções do repositório.

Leia antes: `.devin/instructions/architecture.md`, `.devin/rules/nestjs-conventions.md`, `.devin/rules/testing.md`, `.devin/rules/code-style.md`.

Passos:

1. **DTOs** — `src/core/app/models/{{RECURSO}}.ts`: `{{Recurso}}PutRequest`/`PostRequest`, `{{Recurso}}PatchRequest`, `{{Recurso}}GetResponse`, `{{Recurso}}GetFilter`. Use `class-validator` com mensagens `'O campo $$ não respeita o schema.'`, `@ValidateNested` + `@Type`, validadores de `src/validators/custom-validators.ts` e `@ApiProperty`.
2. **Persistência** — defina a coleção `{{COLECAO}}` e seus sortKeys. Crie-a em `src/main.ts` (`MemoryDB.create('{{COLECAO}}', [...])`) e obtenha no construtor do `PSP` (`MemoryDB.get('{{COLECAO}}')`). Use `IdOwner` como clusterKey.
3. **Regras** — métodos `add{{Recurso}}`, `read{{Recurso}}`, `list{{Recurso}}` (paginação no formato `parametros.paginacao` igual a `_listCob`), `edit{{Recurso}}`, `remove{{Recurso}}` em `src/core/app/psp.ts`. Erros via `MESSAGES` (`src/libs/messages.ts`).
4. **Controller** — `src/controllers/{{RECURSO}}.controller.ts` com `@Controller('{{RECURSO}}')`, `@UseInterceptors(HttpInterceptor)`, `IdOwner` de `headers['IdOwner']`, verbos HTTP corretos (inclusive `@Delete` quando a spec prevê). Registre em `AppModule.controllers`.
5. **Interceptor** — adicione `'{{RECURSO}}'` ao mapa de 400 em `src/http.interceptor.ts` com o prefixo de erro BACEN (`{{Recurso}}OperacaoInvalida`) e o `detail` adequado.
6. **Testes** — `test/{{RECURSO}}.e2e.test.ts` (supertest + `ValidationPipe` com `errorFormatter`) e, se fizer sentido, `test/controllers/{{RECURSO}}.controller.test.ts`. Cubra 200/201, 400 (cada validação), 401 e 404.
7. **Documentação** — atualize a tabela de recursos em `README.md` e em `.devin/instructions/architecture.md`.
8. **Validação** — `npm run build` e `npm test` passando; formate só os arquivos tocados com `npx prettier --write`.

Entregue um PR com resumo das rotas adicionadas, divergências conhecidas em relação à spec e resultado dos testes.
