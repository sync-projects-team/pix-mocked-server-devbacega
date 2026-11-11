---
name: start-server
description: Subir o PIX Mocked Server (API :3000 e Auth :3001) via npm, build ou Docker e fazer smoke test com curl.
---

# Skill: subir o servidor

## Opção A — desenvolvimento (watch)
```bash
npm ci
npm run start:dev
```
Aguarde os logs `Nest application successfully started` (aparecem duas vezes: AppModule e AuthModule).

## Opção B — build compilado
```bash
npm run build
npm run start:prod         # node dist/main
```

## Opção C — Docker
```bash
docker build -t pix-mocked-server .
docker run --rm -p 3000:3000 -p 3001:3001 pix-mocked-server
```

## Smoke test
```bash
curl -s -o /dev/null -w "api-docs 3000: %{http_code}\n" http://localhost:3000/api-docs
curl -s -o /dev/null -w "api-docs 3001: %{http_code}\n" http://localhost:3001/api-docs

TOKEN=$(curl -s -X POST http://localhost:3001/auth \
  -H 'content-type: application/json' \
  -d '{"grant_type":"client_credentials","client_id":"123","client_secret":"abc"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).accesstoken')
echo "$TOKEN"   # 123-abc

curl -s http://localhost:3000/cob/naoexiste -H "mocked-token: $TOKEN"   # 404 padrão BACEN
curl -s http://localhost:3000/cob/naoexiste                              # 401 AcessoNegado
```

## Comportamentos esperados / conhecidos
- `POST /auth` demora ~2 s (simulação) e responde `201` com `{ accesstoken, expires_in: 300 }`.
- Token vai no header `mocked-token`, não em `Authorization`.
- Para parar: `Ctrl+C`, ou `lsof -ti :3000 -ti :3001 | xargs kill`.
