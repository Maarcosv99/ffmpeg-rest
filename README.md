# ffmpeg-rest

API REST para conversão de áudio (MP3 → OPUS e variantes) usando Bun + Elysia + BullMQ + ffmpeg, deployável no Railway.

## Quick start

```bash
docker compose up -d redis    # Redis local
bun install
bun run dev:api               # terminal 1: API em http://localhost:3000
bun run dev:worker            # terminal 2: worker da fila
```

UI da OpenAPI em <http://localhost:3000/openapi>.

## Endpoints

- `POST /convert` — async. Body: `{ url, format, bitrate?, webhook?, webhookData?, webhookSecret? }`. Retorna `{ jobId, statusUrl }`.
- `GET /jobs/:id` — status do job + `outputUrl` quando pronto
- `GET /health` — healthcheck (Railway)
- `GET /openapi` — UI Scalar
- `GET /openapi/json` — spec OpenAPI 3

## Documentação

- Arquitetura, ADRs e fluxos: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Manual para agentes (planning, execution): [`AGENTS.md`](AGENTS.md)
- Features em andamento ou concluídas: `docs/features/<slug>/`

## Comandos

```bash
bun run lint        # Biome
bun run typecheck   # tsc --noEmit
bun run test        # bun test
bun run lint:all    # tudo: lint + types + markdown
```
