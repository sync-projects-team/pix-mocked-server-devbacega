---
name: run-tests
description: Rodar build e testes Jest do PIX Mocked Server (suíte completa, arquivo único ou teste por nome) e interpretar o resultado.
---

# Skill: rodar testes

## Quando usar
Antes de abrir/atualizar um PR, depois de qualquer mudança em `src/` ou `test/`, ou para reproduzir uma falha.

## Passos

1. Garanta Node 20 e dependências:
   ```bash
   node -v            # v20.x
   npm ci
   ```
2. Compile (detecta erros de tipo que o `ts-jest` pode não mostrar no mesmo formato):
   ```bash
   npm run build
   ```
3. Rode os testes:
   ```bash
   npm test                                         # completo + cobertura em coverage/
   npx jest --coverage=false                        # completo, mais rápido
   npx jest test/cobv.e2e.test.ts --coverage=false  # um arquivo
   npx jest -t 'O campo cob.valor.original é zero.' # um caso pelo nome
   ```
4. Critério de sucesso: `Test Suites: 16 passed` / `Tests: 266 passed` (referência atual; aumenta conforme novos testes) e exit code 0.

## Armadilhas
- `npm run test:e2e` roda só as suítes `*.e2e.test.ts` (que também rodam em `npm test`).
- Suítes `cob.controller`/`cobv.controller` levam ~45 s (delays intencionais em `PSP.addLoc` e `Auth.validate`). Não confunda com travamento.
- `Duplicate Collection`: um arquivo de teste está chamando `MemoryDB.create` para a mesma coleção mais de uma vez.
- Não rode `npm run lint` como parte da validação: ele aplica `--fix` em todo o repositório.

## Referências
- `.devin/rules/testing.md`
- `jest.config.ts`, `test/e2e.ts`
