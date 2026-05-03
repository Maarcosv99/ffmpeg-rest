# Tasks — Harden Network Resilience

Cada tarefa tem critério de aceite verificável. Marque `[x]` ao concluir.

## Implementação

- [x] **T1.** Adicionar `CONVERT_RETRY_OPTIONS` em `packages/shared/src/queue.ts`
  - **Arquivo:** [`packages/shared/src/queue.ts`](packages/shared/src/queue.ts)
  - **Aceite:** constante exportada com `attempts: 3, backoff: { type: "exponential", delay: 5_000, jitter: 0.5 }`. Tipo derivado compatível com `defaultJobOptions` do BullMQ.

- [x] **T2.** Aplicar `CONVERT_RETRY_OPTIONS` no queue `convertAudio`
  - **Arquivo:** [`apps/api/src/queues.ts`](apps/api/src/queues.ts)
  - **Aceite:** `defaultJobOptions: { ...JOB_RETENTION, ...CONVERT_RETRY_OPTIONS }` no `new Queue<ConvertAudioJobPayload>(...)`. Sem afetar `webhookDelivery`.

- [x] **T3.** Adicionar dep `@aws-sdk/lib-storage` em `packages/storage`
  - **Arquivo:** [`packages/storage/package.json`](packages/storage/package.json)
  - **Aceite:** `^3.687.0` (alinhar major com `@aws-sdk/client-s3` existente). `bun install` recompila lockfile sem warnings.

- [x] **T4.** Substituir `PutObjectCommand` + `createReadStream` por `Upload.done()`
  - **Arquivo:** [`packages/storage/src/index.ts`](packages/storage/src/index.ts)
  - **Aceite:** `putObject` constrói `new Upload({ client, params: { Bucket, Key, Body: createReadStream(filePath), ContentType, ContentLength } })` e aguarda `await upload.done()`. Comportamento externo idêntico (retorna `string` do `getPublicUrl`).

- [x] **T5.** Adicionar env var `DOWNLOAD_TIMEOUT_MS` ao schema Zod
  - **Arquivo:** [`packages/shared/src/env.ts`](packages/shared/src/env.ts)
  - **Aceite:** `DOWNLOAD_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000)`. Test de carregamento usando default e override.

- [x] **T6.** Reescrever `download.ts` com `AbortController` manual + `Readable.fromWeb` + `Transform` que conta bytes
  - **Arquivo:** [`apps/worker/src/download.ts`](apps/worker/src/download.ts)
  - **Aceite:**
    - `AbortController` com `setTimeout(() => controller.abort(), env.DOWNLOAD_TIMEOUT_MS)` (NÃO usar `AbortSignal.timeout`)
    - Stream pipeline: `Readable.fromWeb(response.body) → Transform (counts bytes, throws DownloadError if > maxBytes) → createWriteStream(destPath)`
    - Header `Content-Length` continua validado antes do stream (early-fail)
    - `clearTimeout` no `finally` para não vazar timer
    - Função externa preserva assinatura `(url, destPath, maxBytes)` mas recebe `timeoutMs` adicional via param ou via `env`

- [x] **T7.** Propagar `env.DOWNLOAD_TIMEOUT_MS` para o `downloadToFile` no processor
  - **Arquivo:** [`apps/worker/src/processors/convert-audio.ts`](apps/worker/src/processors/convert-audio.ts)
  - **Aceite:** chamada de `downloadToFile` recebe `timeoutMs: env.DOWNLOAD_TIMEOUT_MS`. Sem outras mudanças na orquestração do processor.

- [x] **T8.** Auditar logs do worker para garantir que nenhum `job.data` é serializado em log
  - **Arquivos:** [`apps/worker/src/index.ts`](apps/worker/src/index.ts), [`apps/worker/src/processors/*.ts`](apps/worker/src/processors/)
  - **Aceite:** `grep -rn "job\.data" apps/worker/src/` mostra **apenas** uso de propriedades específicas (ex: `job.data.url`, `job.data.format`, `job.data.webhook`), nunca o objeto inteiro. Verificar especialmente `worker.on("failed", ...)` log handler em `apps/worker/src/index.ts`.

## Tests

- [x] **T-test-1.** Smoke test do shape de `CONVERT_RETRY_OPTIONS`
  - **Arquivo:** [`packages/shared/tests/queue.test.ts`](packages/shared/tests/queue.test.ts) (novo)
  - **Aceite:** importa a constante, asserta `attempts === 3`, `backoff.type === "exponential"`, `backoff.delay === 5_000`, `backoff.jitter === 0.5`.

- [x] **T-test-2.** Test de `loadEnv` com `DOWNLOAD_TIMEOUT_MS`
  - **Arquivo:** [`packages/shared/tests/env.test.ts`](packages/shared/tests/env.test.ts) (existente, adicionar 2 testes)
  - **Aceite:** (a) default `60_000` quando ausente; (b) custom value via env. Padrão idêntico aos testes de `S3_KEY_PREFIX`.

- [x] **T-test-3.** Mock test do `storage.putObject` invocando `Upload.done()`
  - **Arquivo:** [`packages/storage/tests/index.test.ts`](packages/storage/tests/index.test.ts) (novo)
  - **Aceite:** mock do `S3Client` (com `mock` do Bun) e do `Upload.prototype.done`. Asserta:
    - `done()` é chamado exatamente uma vez por `putObject`
    - `Upload` recebe params com `Bucket`, `Key`, `ContentType` corretos
    - retorno é a URL pública gerada via `getPublicUrl`

- [x] **T-test-4.** Suite de `download.test.ts` (4 cenários mínimos)
  - **Arquivo:** [`apps/worker/tests/download.test.ts`](apps/worker/tests/download.test.ts) (novo)
  - **Setup:** `createServer` Node HTTP local em porta efêmera, expondo:
    - `/ok` → retorna 1KB de bytes válidos
    - `/large` → retorna `Content-Length` declarado mas envia mais bytes
    - `/slow` → escreve 1 byte e pendura (sem fechar)
    - `/notfound` → 404
  - **Aceite:**
    - **(a) Happy path:** baixa `/ok`, tamanho do arquivo no disco === bytes recebidos
    - **(b) Size limit early via Content-Length:** GET com `maxBytes=10` em response que declara 1024 → rejeita com `DownloadError` antes de baixar
    - **(c) Size limit during streaming:** baixar `/large` (servidor mente no header) com `maxBytes` menor → rejeita com `DownloadError` durante o stream e cancela conexão
    - **(d) Timeout via AbortController:** `/slow` com `timeoutMs=200` → rejeita com erro de abort dentro de ~200-500ms
    - **(e) Erro HTTP:** `/notfound` rejeita com `DownloadError` mencionando 404

- [x] **T-test-5.** Atualizar `BASE_ENV` dos testes existentes para incluir `DOWNLOAD_TIMEOUT_MS`
  - **Arquivos:** [`apps/api/tests/helpers/test-app.ts`](apps/api/tests/helpers/test-app.ts), [`apps/worker/tests/processors/webhook-delivery.test.ts`](apps/worker/tests/processors/webhook-delivery.test.ts)
  - **Aceite:** ambos os fakes têm `DOWNLOAD_TIMEOUT_MS: 60_000` adicionado. Suite existente (71 testes) continua passando.

## Documentação

- [x] **T-doc-1.** Atualizar `.env.example` com `DOWNLOAD_TIMEOUT_MS`
  - **Arquivo:** [`.env.example`](.env.example)
  - **Aceite:** linha `DOWNLOAD_TIMEOUT_MS=60000` com comentário curto explicando.

- [x] **T-doc-2.** Atualizar `docs/ARCHITECTURE.md` com nota sobre retry/resiliência
  - **Arquivo:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
  - **Aceite:** adicionar parágrafo curto na seção "Ciclo de vida de um job" descrevendo: (a) jobs `convert-audio` têm 3 tentativas com backoff exponencial + jitter, (b) upload via `Upload.done()` da `@aws-sdk/lib-storage` com retry no nível de cada request HTTP, (c) download com timeout configurável (`DOWNLOAD_TIMEOUT_MS`).
  - **Não** criar um novo ADR — é refinamento operacional, não decisão arquitetural nova. Se for criar, ADR-008 "Retry config" é a opção, mas avaliar antes se vale o overhead.

- [x] **T-doc-3.** Atualizar `INDEX.md` desta feature com status final + diagramas Mermaid
  - **Arquivo:** [`docs/features/harden-network-resilience/INDEX.md`](docs/features/harden-network-resilience/INDEX.md)
  - **Aceite:** status `done`, timestamp atualizado, seção "Diagramas" preenchida (sequenceDiagram do retry path em job que falha → reenfileira → succeeds, OU "Sem mudança de fluxo" se decidir que macro flow não muda — caso de borda válido).

## Revisão

- [x] **T-rev-1.** Review de arquitetura — invocar `architecture-reviewer`
  - **Aceite:** report PASS ou PASS_WITH_NOTES. Sem violações de ADR. Sem dependências indevidas. Sem ciclo introduzido.

- [x] **T-rev-2.** Review de segurança — invocar `security-reviewer`
  - **Aceite:** **Critical** items obrigatórios:
    - Size limit no streaming continua ativo (verificar via `grep` no código + verificar T-test-4 cenário (c))
    - Nenhum `console.log` ou similar em apps/worker dumpa `job.data` cru (T8)
    - `DOWNLOAD_TIMEOUT_MS` é numérico, não interpolado em string que vá pro shell
    - Validação anti-SSRF do webhook continua intacta (não foi tocada)
  - Sem alertas Critical pendentes.

- [x] **T-rev-3.** Review de cobertura — invocar `test-coverage-reviewer`
  - **Aceite:**
    - `bun test --coverage` mostra `apps/worker/src/download.ts` em ≥ 80% lines/branches
    - `packages/storage/src/index.ts` em ≥ 70%
    - Cenários de erro do download.ts cobertos (timeout, size, 404, content-length lying)
    - Sem queda de cobertura nos arquivos não tocados.

- [x] **T-rev-4.** Validação de deploy obrigatória (mudou Dockerfile / package.json / bun.lock)
  - **Aceite:** `bun run docker:check` passa local. CI (`.github/workflows/ci.yml`) verde no commit final. Nota: T3 muda `packages/storage/package.json` → o `bun.lock` será atualizado, gatilhando a regra do `feature-executor` para rodar `docker:check`.

## Verificação end-to-end (smoke teste manual após deploy)

Não é tarefa formal, mas vale validar pós-deploy:

1. Disparar `POST /convert` em produção com áudio de URL conhecidamente flaky (CDN com timeout curto)
2. Observar logs do worker — confirmar mensagem de retry quando ocorre, e job final `completed` (em vez de `failed` direto)
3. Confirmar no R2 que objeto foi criado mesmo em job retry (sem chave duplicada / órfão)
