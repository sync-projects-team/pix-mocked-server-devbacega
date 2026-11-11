---
name: build-docker
description: Construir e executar a imagem Docker do PIX Mocked Server e diagnosticar problemas do build multi-stage.
---

# Skill: build e execução Docker

## Comandos
```bash
docker build -t pix-mocked-server .
docker run --rm --name pix-mock -p 3000:3000 -p 3001:3001 pix-mocked-server
docker logs -f pix-mock
```

## Como o `dockerfile` funciona
1. `base` (`node:20`): instala `@nestjs/cli` global.
2. `init`: `COPY package.json .` + `npm i` (o `package-lock.json` **não** é copiado; versões podem divergir do local).
3. `build`: copia `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `jest.config.ts` e `COPY src/ .` (conteúdo de `src/` na raiz de `/app`), roda `yarn build` → `/app/dist/main.js`.
4. `final` (`node:20.16.0-alpine`): copia `node_modules` (com devDependencies) e `dist/`, `EXPOSE 3000 3001`, `ENTRYPOINT ["node", "main.js"]`.

## Diagnóstico
- **Estado atual: o build falha** no estágio `build` com `TS2307: Cannot find module '../../src/core/app/models/loc'` (e `../../src/core/app/psp`, `../../src/http.interceptor`). Causa: `src/controllers/location.controller.ts` importa saindo de `src/`, e no container `src/` é achatado em `/app`. Correção: usar `../core/app/models/loc`, `../core/app/psp` e `../http.interceptor`.
- Regra geral: imports relativos dentro de `src/` funcionam; qualquer import que suba até a raiz e volte para `src/` quebra no Docker.
- Imagem grande: `node_modules` do estágio `init` inclui devDependencies.
- Testes não rodam no Docker (pasta `test/` não é copiada). Rode `npm test` localmente/CI antes.
