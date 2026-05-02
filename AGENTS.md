# AGENTS.md

Manual de bordo do `ffmpeg-rest`. Leia antes de tocar em qualquer coisa.

## TL;DR

- **Stack:** Bun + Elysia + BullMQ. Monorepo com `apps/` e `packages/`.
- **Deploy:** Railway (1 serviço API + 1 serviço worker + 1 Redis add-on).
- **Princípio número um: simplicidade.** Reuse antes de criar; edite antes de adicionar; recuse complexidade especulativa.

## Como rodar localmente

```bash
docker compose up -d redis      # ou redis-server local na porta 6379
bun install
bun run dev:api                 # terminal 1
bun run dev:worker              # terminal 2
```

UI da API em <http://localhost:3000/openapi>.

## Workflow para criar ou modificar features

```mermaid
flowchart LR
  user["Usuário define feature"] --> planner["feature-planner"]
  planner -.->|info externa?| researcher["feature-researcher"]
  researcher -.->|síntese + citações| planner
  planner -->|consulta| reviewers[("3 reviewers")]
  planner -->|escreve| files[/"docs/features/<slug>/<br/>INDEX.md + TASKS.md"/]
  files --> executor["feature-executor"]
  executor -->|atualiza| files
  executor -->|invoca ao fim| reviewers
```

### Planejar
1. Invoque o agente `feature-planner` com o que você quer construir
2. Se precisar de info externa (versão de lib, CVE, comparação), o planner delega ao `feature-researcher`
3. Ele consulta os 3 reviewers (arquitetura, segurança, cobertura) e gera dois arquivos em `docs/features/<slug>/`
4. Revise `INDEX.md` (incluindo a seção "Pesquisas externas") e `TASKS.md`. Edite se quiser ajustar.

### Executar
1. Invoque o agente `feature-executor` com o slug da feature
2. Ele itera `TASKS.md` em ordem, marcando progresso, rodando lint+testes a cada passo
3. Ao final invoca os reviewers e abre tarefas pra cada alerta — resolve até `INDEX.md` ficar com status `done`
4. Atualiza diagramas Mermaid no `INDEX.md` ao terminar

### Revisar ad-hoc
- `architecture-reviewer` — após mudança estrutural
- `security-reviewer` — após tocar webhook delivery / ffmpeg / URL validation
- `test-coverage-reviewer` — antes de release
- `feature-researcher` — pesquisa externa pontual fora do contexto de uma feature

## Onde encontrar cada coisa

| Você quer entender... | Vá para |
|---|---|
| Visão geral, fluxo, ADRs | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Status e tarefas de uma feature | `docs/features/<slug>/INDEX.md` e `TASKS.md` |
| Schemas Zod (validação + payload de jobs) | `packages/shared/src/schemas/` |
| Entrypoint da API | `apps/api/src/index.ts` |
| Entrypoint do Worker | `apps/worker/src/index.ts` |
| Lógica do ffmpeg | `packages/ffmpeg/src/` |
| Cliente S3/R2 | `packages/storage/src/` |
| Conexão Redis | `packages/redis/src/` |
| Validação de env | `packages/shared/src/env.ts` |
| Validação anti-SSRF de webhook | `packages/shared/src/security/url-validator.ts` |
| Tasks pendentes do projeto | `docs/features/*/TASKS.md` (linhas com `[ ]`) |
| Decisão histórica | `docs/ARCHITECTURE.md` (seção ADRs) ou `docs/features/<slug>/INDEX.md` |

## Convenções

- **Lint:** `bun run lint` (Biome). Não desabilite regras sem registrar o porquê em `INDEX.md`.
- **Tipos:** `bun run typecheck` deve passar.
- **Testes:** `bun test`. Toda mudança de schema ou lógica de segurança exige teste.
- **Commits:** título imperativo curto, corpo opcional explicando *por quê*.
- **Branches:** uma por feature, nome igual ao slug do `docs/features/<slug>/`.
- **Comentários:** só pra *por quê* não-óbvio. Sem narração.

## Quando NÃO usar os agentes orquestradores

- Typo em string ou comentário
- Bump de versão de dependência
- Renomear variável local
- Ajuste de log

Esses casos são pequenos demais pra justificar o overhead de criar `INDEX.md`/`TASKS.md`. Faça direto.

## Skills instaladas

Estas skills enriquecem o contexto do agente:

- `bun-runtime` — runtime patterns
- `use-railway` — deploy + serviços + variáveis
- `ffmpeg` — patterns do ffmpeg para conversão de áudio/vídeo

## Ambiente

Variáveis obrigatórias estão em [`packages/shared/src/env.ts`](packages/shared/src/env.ts) (validação Zod). A aplicação falha no boot se algo estiver faltando.
