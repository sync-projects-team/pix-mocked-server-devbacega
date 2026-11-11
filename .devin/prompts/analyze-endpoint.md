# Prompt: analisar um endpoint

Use com o agente `api-analyst`. Substitua `{{RECURSO}}` (ex.: `cob`, `cobv`, `loc`, `rec`, `cobr`) e, se quiser, `{{VERBO}} {{ROTA}}`.

---

Analise o endpoint `{{VERBO}} /{{RECURSO}}{{ROTA}}` do PIX Mocked Server.

1. Leia `.devin/instructions/architecture.md` e `.devin/rules/nestjs-conventions.md`.
2. Localize:
   - o controller em `src/controllers/{{RECURSO}}.controller.ts` e confirme se ele está registrado em `src/app.module.ts`;
   - o DTO em `src/core/app/models/{{RECURSO}}.ts` (decorators `class-validator`, `@ApiProperty`);
   - o(s) método(s) do `PSP` em `src/core/app/psp.ts` e as coleções do `MemoryDB` usadas;
   - o tratamento no `HttpInterceptor` (`src/http.interceptor.ts`) — prefixo de erro 400 para `{{RECURSO}}`.
3. Compare com a especificação oficial em https://bacen.github.io/pix-api/ para o mesmo endpoint (campos obrigatórios, tipos, patterns, status HTTP, formato de erro).
4. Verifique os testes existentes (`test/{{RECURSO}}.e2e.test.ts`, `test/controllers/{{RECURSO}}.controller.test.ts`) e quais cenários não estão cobertos.
5. Se possível, suba o servidor (`.devin/skills/start-server.md`) e reproduza com `curl` usando `mocked-token: 123-abc`.

Entregue em Markdown:

- **Resumo** (2–3 linhas)
- **Fluxo**: controller → PSP → MemoryDB → resposta
- **Tabela de campos**: campo | obrigatório (BACEN) | validação no mock | divergência
- **Status HTTP**: esperados pela spec x produzidos pelo mock
- **Cobertura de testes**: cenários cobertos / faltantes
- **Achados** com severidade e evidência (arquivo:linha ou saída de `curl`)
- **Recomendações** priorizadas

Não altere código nesta tarefa.
