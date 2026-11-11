# Parecer Kaizen — Recursos Pix BACEN (cobr, rec, pix, webhook) e correções estruturais (2026-11-11)

Agente: `kaizen-guardian` (`.devin/agents/kaizen-guardian.md`), ativo desde o 1º commit.
Contexto lido: `.devin/instructions/architecture.md`, `.devin/rules/*`, OpenAPI oficial BACEN (`bacen/pix-api`, `openapi.yaml`).

**Linha de base (Check inicial):** 16 suítes / 266 testes verdes. **Final:** 19 suítes / 323 testes verdes; `npm run build` verde.

## Commits (PDCA, um tema por commit)

| # | Commit | Tema |
| --- | --- | --- |
| 1 | `docs(harness)` | Agente Kaizen + `.devin/README.md` + estrutura do `README.md` (antes de qualquer código) |
| 2 | `fix(bootstrap)` | Coleções `COBR`, `WEBHOOK`, `PIX` em `COLLECTIONS` |
| 3 | `feat(auth)` | `Authorization: Bearer` + `access_token`; tabela única de erros 400 |
| 4 | `feat(cobr)` | `/cobr` completo na coleção `COBR` |
| 5 | `feat(rec)` | `GET`/`PATCH /rec/:idRec`, `GET /rec`, `GET /rec/:idRec/ativacao` |
| 6 | `feat(webhook)` | `/webhook` |
| 7 | `feat(pix)` | `/pix` + registro de Pix ao `CONCLUIDA` |
| 8 | `feat(cobv)` | `valor.abatimento` |
| 9 | `fix(cobr)` | Defeito encontrado pelo Check antes do commit de testes |
| 10 | `test(e2e)` | e2e de `cobr`, `rec`, `webhook`, `pix` |
| 11 | `docs` | Arquitetura/README/regras + este parecer |

## Desperdícios evitados

| Desperdício | Onde | Como foi evitado | Severidade |
| --- | --- | --- | --- |
| Retrabalho (genchi genbutsu) | Fase 2, itens 1–4 | Leitura do código atual mostrou que `ValidationPipe`, `LOC_COB`/`COB_HIST`/`REC`, imports relativos de `location.controller.ts`, `testRegex` e `@Delete` já tinham sido corrigidos (refatoração para `src/bootstrap.ts`). Nada foi refeito; só faltavam `COBR`, `WEBHOOK`, `PIX`, adicionados em `COLLECTIONS` (não em `main.ts`, para não duplicar `MemoryDB.create` → `Duplicate Collection`). | Alta |
| Retrabalho (ordem) | Bootstrap antes de controllers | Coleções registradas no 2º commit; os controllers novos já nasceram funcionando no runtime real (`setupDatabase`). | Alta |
| Duplicação | `HttpInterceptor` | 4 lambdas idênticas do 400 → tabela `BAD_REQUEST_TYPES`. Os 3 prefixos novos (`CobR`, `Webhook`, `Pix`) entraram como 3 linhas, não 3 blocos copiados. | Média |
| Duplicação | `PSP` | Helpers `_owner`, `_randomAlnum`, `_inPeriod`, `_listResult` reutilizados por `cobr`, `rec`, `webhook`, `pix` (4 listas, 1 paginação). `addRec` passou a usar `_owner`. | Média |
| Duplicação | Testes | Helper genérico `expectRequest` (em vez de um helper por verbo/status) e fixture `buildRec` compartilhada entre `rec` e `cobr`. | Baixa |
| Defeito | `HttpInterceptor` | Endpoint vinha de `request.url` com querystring (`/cob?cpf=x` → `cob?cpf=x` → `handle` indefinido → 500). Agora usa o path; endpoint sem mapa relança o erro. | Alta |
| Defeito | `cobr` | `GET/PATCH/DELETE /cobr` liam/alteravam/**apagavam** a coleção `COB`. Corrigido para `COBR`. `DELETE /cobr` removido (não existe na spec e apagava `cob`). | Alta |
| Defeito | `rec` | `idRec` tinha espaço no fim e não tinha sufixo aleatório → 2ª recorrência do dia no mesmo owner dava `Duplicate Key` (500). Agora segue o pattern BACEN (29 chars). | Alta |
| Defeito | `cobv` (`_editCob`) | `PATCH` descartava `valor.desconto/juros/multa` enviados (valor sobrescrito antes do merge) e dava 500 em `cobv` sem esses campos. Corrigido no mesmo trecho em que o `abatimento` precisava entrar. | Média |
| Defeito (Check) | `editCobR` | `PATCH { status: CANCELADA }` repetido devolvia 200. Encontrado pelo teste e corrigido em commit próprio antes de commitar os testes. | Média |
| Superprodução (veto) | `POST /auth` | `token_type` chegou a ser adicionado e foi **vetado** (não pedido). | Baixa |
| Superprodução (veto) | Formatação | Arquivos legados não foram reformatados (≈2.9k erros de Prettier); Prettier só nos arquivos novos, diff mínimo. | Média |

## Economia gerada

- **11 commits lógicos**, cada um com build/teste verde; revisão por tema.
- **Código morto removido**: `PSP.cobV`/`MemoryDB.get("COBV")` (coleção nunca criada), `txid` não usado em `RecController.create`, DTOs de cobr não usados (`CobRValor`, `Alteracao`, `Retirada`, `ICobRQueryRequest/Response`, `ICobRPatchResponse`), `return await null` em `PUT /cobr`, comentários mortos no interceptor.
- **Escopo preservado**: Fase 2 verificada em vez de reescrita; nenhuma dependência nova; `accesstoken` e `mocked-token` mantidos por compatibilidade.
- **Testes**: +57 casos (266 → 323) sem aumento relevante do tempo da suíte (~46 s → ~48 s).
- **Docs no mesmo PR** (Shitsuke): `architecture.md`, `README.md`, `nestjs-conventions.md`.

## Melhorias sugeridas (backlog Kaizen)

| # | Melhoria | Arquivo(s) | Tipo | Esforço |
| --- | --- | --- | --- | --- |
| 1 | Migrar `_listCob` e `listLoc` para `_listResult`/`_inPeriod` (hoje `paginacao` vinda da query é string: `ini + itens` concatena; `locationPresente=false` é truthy) | `src/core/app/psp.ts` | kaizen | P |
| 2 | Remover `src/controllers/fakedb.ts` (cópia morta de `src/libs/fakedb.ts`) | `src/controllers/fakedb.ts` | kaizen | P |
| 3 | Testes e2e legados (`cob`, `cobv`, `rec`, `location`) usarem `setupDatabase()` + `createValidationPipe()` em vez de pipe/coleções copiados | `test/*.e2e.test.ts` | kaizen | P |
| 4 | Erros de negócio hoje lançados como `Error` (→ 500), ex. `joinLocCob`, deveriam ser `BadRequestException` com violação | `src/core/app/psp.ts` | kaizen | M |
| 5 | Endpoint mock explícito de pagamento (ex.: `POST /cob/:txid/pagar`) em vez de `PATCH status=CONCLUIDA` (fora da spec) | `cob`/`cobv` | kaizen | P |
| 6 | Devoluções (`PUT/GET /pix/:e2eid/devolucao/:id`) e disparo real de webhook ao registrar Pix | `pix`, `webhook` | kaizen | M |
| 7 | Retentativa de `cobr`: validar janela de 7 dias a partir do vencimento | `retentativaCobR` | kaizen | P |
| 8 | Reformatar o repositório com Prettier num PR isolado | todo o repo | **kaikaku** | M |
| 9 | Remover delays artificiais (`Auth.validate` 2 s, `addLoc` 100 ms) dos testes via injeção de tempo | `auth.ts`, `psp.ts` | kaizen | M |

## Riscos observados

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| `PATCH { status: "CONCLUIDA" }` em `cob`/`cobv` é extensão do mock (a spec só permite `REMOVIDA_PELO_USUARIO_RECEBEDOR`) | Clientes podem supor que é comportamento BACEN | Documentado em `architecture.md`/`README.md`; backlog #5 |
| `GET /rec/:idRec/ativacao` não existe na spec 2.11 | Divergência com a spec oficial | Documentado como extensão; resposta derivada de `ativacao.dadosJornada` |
| DTO de `cobr` mudou (`dadosDevedor`/`contaRecebedor` → `devedor`/`recebedor`, `valor` obrigatório) | Quebra para quem usava o shape antigo | Rotas não estavam expostas antes (controller fora do `AppModule`); shape agora segue a spec |
| `DELETE /cobr/:txid` removido | Quem esperasse a rota recebe 404 | A rota não existe na spec e apagava dados de `cob` |
| Estado em memória | Dados somem a cada restart; owners isolados por `IdOwner` | Comportamento esperado do mock |
| `inicio`/`fim` opcionais nas listas novas (na spec são obrigatórios) | Mock mais permissivo que o PSP real | Mantido por usabilidade; alinhar se necessário |
