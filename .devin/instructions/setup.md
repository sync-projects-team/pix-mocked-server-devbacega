# Setup e execução

Instruções operacionais para rodar o PIX Mocked Server localmente, via Docker ou devcontainer.
Arquitetura completa em [`architecture.md`](./architecture.md).

## Pré-requisitos

- Node.js **20** (mesma versão de `dockerfile` e `.devcontainer/devcontainer.json`) e npm.
- Opcional: `@nestjs/cli` global (`npm i -g @nestjs/cli`) — os scripts usam o binário local de `node_modules`, então não é obrigatório.
- Portas **3000** (API) e **3001** (auth) livres.

## 1. npm (local)

```bash
npm ci                    # instala exatamente o package-lock.json
npm run start:dev         # nest start --watch  -> :3000 e :3001
```

Scripts disponíveis (`package.json`):

| Script | Comando | Observação |
| --- | --- | --- |
| `build` | `nest build` | Gera `dist/` (entrypoint `dist/main.js`; `jest.config.ts` fica fora via `tsconfig.build.json`). |
| `start` | `nest start` | Compila e sobe uma vez. |
| `start:dev` | `nest start --watch` | Recomendado para desenvolvimento. |
| `start:debug` | `nest start --debug --watch` | Inspector na porta padrão 9229. |
| `start:prod` | `node dist/main` | Sobe o build gerado por `npm run build`. |
| `test` | `jest` | Roda todas as suítes (`test/**/*.test.ts`) com cobertura em `coverage/`. |
| `test:watch` / `test:cov` / `test:debug` | variações do Jest | |
| `test:e2e` | `jest --config ./test/jest-e2e.json` | Roda só as suítes `*.e2e.test.ts` (também incluídas em `npm test`). |
| `lint` | `eslint ... --fix` | Reescreve arquivos. Ver `.devin/rules/code-style.md`. |
| `format` | `prettier --write src test` | Reformata todo o código. |

Verificação rápida após subir:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api-docs   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api-docs   # 200
curl -s -X POST http://localhost:3001/auth \
  -H 'content-type: application/json' \
  -d '{"grant_type":"client_credentials","client_id":"123","client_secret":"abc"}'
# {"accesstoken":"123-abc","expires_in":300}   (resposta demora ~2s)
```

Chamadas à API principal usam o header `mocked-token`:

```bash
curl -s http://localhost:3000/cob/<txid> -H 'mocked-token: 123-abc'
```

## 2. Docker

```bash
docker build -t pix-mocked-server .
docker run --rm -p 3000:3000 -p 3001:3001 pix-mocked-server
```

> O `dockerfile` copia o conteúdo de `src/` achatado em `/app`; por isso imports em `src/` nunca devem usar `../../src/...`.

Estágios do `dockerfile`:

1. `base` — `node:20` + `@nestjs/cli` global.
2. `init` — copia só `package.json` e roda `npm i` (sem lockfile).
3. `build` — copia `tsconfig*.json`, `nest-cli.json`, `jest.config.ts` e **o conteúdo de `src/` direto em `/app`**, depois `yarn build` → `dist/main.js`.
4. `final` — `node:20.16.0-alpine`, copia `node_modules` e `dist/`, `EXPOSE 3000 3001`, `ENTRYPOINT ["node", "main.js"]`.

## 3. Devcontainer

`.devcontainer/devcontainer.json` usa a imagem `node:20` e executa `npm i -g @nestjs/cli && npm i` no `postCreateCommand`.

1. No VS Code: *Dev Containers: Reopen in Container*.
2. Dentro do container: `npm run start:dev`.
3. Encaminhe as portas 3000 e 3001 (o arquivo não declara `forwardPorts`; o VS Code detecta automaticamente quando o processo abre as portas).

## 4. Testes

```bash
npm test                              # tudo, com cobertura
npx jest test/cob.e2e.test.ts         # uma suíte
npx jest -t 'O campo cob.valor.original é zero.'   # um teste pelo nome
npx jest --coverage=false             # mais rápido
```

- Duração típica: ~50 s (as suítes `cob.controller` e `cobv.controller` levam ~45 s por causa do delay de 100 ms em `PSP.addLoc` e dos 2 s de `Auth.validate`).
- Resultado de referência: **16 suítes, 266 testes passando**.

## 5. Troubleshooting

| Sintoma | Causa provável | Ação |
| --- | --- | --- |
| `EADDRINUSE :3000/:3001` | Outra instância rodando | `lsof -i :3000` / `kill` o processo |
| `Cannot find module '.../dist/main'` | `start:prod` sem build | Rode `npm run build` antes |
| `401 Access Token inválido.` | Falta header `mocked-token` ou token não está em `db.json.owners` | Envie `mocked-token: 123-abc` |
| `400 ... corresponde a uma conta que não pertence a este usuário recebedor` | `chave` não existe em `db.json.correntistas` | Use uma `chave` do seed |
| `docker build` falha com `TS2307 ... '../../src/...'` | Algum import `../../src/...` + `src/` achatado no `dockerfile` | Use caminhos relativos ao arquivo |
| `Duplicate Collection` em teste | `MemoryDB.create` chamado 2x no mesmo processo Jest | Crie coleções uma vez por arquivo de teste (`beforeAll`) |
