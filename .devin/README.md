# Harness de IA (`.devin/`)

Material para agentes de IA (Devin e similares) trabalharem neste repositório com contexto real do código.
Comece por `instructions/architecture.md`.

| Pasta | Conteúdo | Arquivos |
| --- | --- | --- |
| `instructions/` | Instruções operacionais e análise do sistema | `architecture.md`, `setup.md` |
| `rules/` | Regras e convenções que todo código/PR deve seguir | `code-style.md`, `testing.md`, `nestjs-conventions.md` |
| `skills/` | Procedimentos reutilizáveis passo a passo | `run-tests.md`, `start-server.md`, `swagger-docs.md`, `build-docker.md` |
| `agents/` | Papéis especializados (missão, contexto, checklist) | `api-analyst.md`, `test-engineer.md`, `kaizen-guardian.md` |
| `reports/` | Pareceres e relatórios gerados pelos agentes (ex.: parecer Kaizen) | `kaizen-parecer-<data>.md` |
| `prompts/` | Prompts recorrentes parametrizáveis (`{{VAR}}`) | `analyze-endpoint.md`, `add-pix-resource.md` |

## Fluxo sugerido para um agente

1. Ler `instructions/architecture.md` (o que é o sistema e limitações conhecidas).
2. Ler as `rules/` relevantes para a tarefa.
3. Executar via `skills/` (subir servidor, rodar testes, Docker, Swagger).
4. Para tarefas recorrentes, partir de um arquivo em `prompts/` e, se útil, assumir um papel de `agents/`.
5. Durante toda a execução, aplicar o `agents/kaizen-guardian.md` (melhoria contínua): evitar retrabalho, duplicação, código morto e mudanças fora de escopo; ao final, gerar o parecer em `reports/`.
6. Antes de concluir: `npm run build` e `npm test` passando.

## Manutenção

- Estes arquivos descrevem o código; ao mudar comportamento (rotas, coleções do `MemoryDB`, scripts, Docker), atualize o arquivo correspondente no mesmo PR.
- Skills e agentes têm frontmatter YAML (`name`, `description`) para facilitar indexação por ferramentas.
