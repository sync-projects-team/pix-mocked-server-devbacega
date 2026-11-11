---
name: swagger-docs
description: Consultar, exportar e manter a documentação Swagger/OpenAPI dos dois servidores do PIX Mocked Server.
---

# Skill: documentação Swagger

## Onde está
| Servidor | UI | JSON | Config |
| --- | --- | --- | --- |
| API principal | http://localhost:3000/api-docs | http://localhost:3000/api-docs-json | `src/swagger-app.config.ts` |
| Auth | http://localhost:3001/api-docs | http://localhost:3001/api-docs-json | `src/swagger-auth.config.ts` |

Registrado em `src/main.ts` com `SwaggerModule.createDocument` + `SwaggerModule.setup('api-docs', app, document)`.
Referência oficial a ser seguida: https://bacen.github.io/pix-api/

## Exportar o OpenAPI
Com o servidor rodando (skill `start-server`):
```bash
curl -s http://localhost:3000/api-docs-json > openapi-app.json
curl -s http://localhost:3001/api-docs-json > openapi-auth.json
```
Não commite esses arquivos sem combinar com o time (são gerados).

## Documentar um endpoint/DTO novo
1. Em cada propriedade do DTO (`src/core/app/models/<recurso>.ts`), adicione `@ApiProperty({ description: '...', example: ... })` (ou `@ApiPropertyOptional`). Veja `src/controllers/auth.models.ts`.
2. Para DTOs compostos use os helpers de `@nestjs/swagger` (`IntersectionType`, `PartialType`), como em `CobValor extends IntersectionType(Valor, Alteracao, Retirada)`.
3. Opcional no controller: `@ApiTags('<recurso>')`, `@ApiOperation({ summary })`, `@ApiResponse({ status, description })`.
4. Suba o servidor e confira o recurso na UI.

## Observações
- O esquema de segurança declarado na API principal é bearer `access-token`, mas a autenticação real usa o header `mocked-token` (lido em `src/http.interceptor.ts`). Ao testar pela UI, adicione o header manualmente ou use Postman/curl.
- O auth declara `oauth2` `clientCredentials` com `tokenUrl: /auth`; a resposta usa a chave `accesstoken` (não `access_token`), então o fluxo "Authorize" do Swagger UI pode não preencher o token automaticamente.
