# Sanad (سند)

"Sanad" is Arabic for a supporting document, a receipt, a chain of evidence back to a source. That's the whole design: a bank policy Q&A assistant built on retrieval-augmented generation (RAG). Documents get chunked and embedded once, then every question is answered only from what's actually retrieved — with citations back to the document and section. If nothing relevant is retrieved, it says so instead of guessing.

## How it works

1. `chunk.js` splits each markdown document by `##` section headings, then further splits any section longer than 150 words into overlapping 150-word windows (30-word overlap) so no fact gets cut across a chunk boundary invisibly. If a document has no `##` headings at all (e.g. plain pasted text), it falls back to treating the whole body as one section — otherwise it silently produced zero chunks and became unsearchable.
2. `embeddings.js` turns each chunk into a vector using a small local model (`all-MiniLM-L6-v2`, via `@xenova/transformers`) — runs on your machine, no external API key or per-call cost.
3. `ingestDocument.js` runs chunking + embedding for one document; both `ingest.js` (the CLI script, for the starter documents) and the `/api/documents` upload endpoint call this same function, so there's one place that logic lives.
4. `indexStore.js` is the single place that reads and writes `data/index.json`, with an in-memory cache. `addOrReplace(docId, chunks)` swaps out just one document's chunks without touching the rest.
5. On a question, `retrieve.js` embeds the query and ranks all stored chunks by cosine similarity. Only the top 4 above a similarity floor (0.3) are kept — below that, nothing is passed to Claude at all.
6. `server.js` sends only those retrieved excerpts to Claude, instructed to answer strictly from them and cite which excerpt backed each claim.

## Adding documents live

Beyond the 4 starter documents, `POST /api/documents` (title + content) writes a new `.md` file, chunks and embeds it immediately, and merges it into the index — no restart, no rerunning the CLI script. The frontend has an "+ Add document" panel that does this. This is what makes it a platform rather than a fixed demo: the searchable set grows without touching code.

## Setup

```
cd backend
npm install
npm run ingest        # builds data/index.json from the 4 starter documents — first run downloads the embedding model (~90MB)
cp .env.example .env  # add your ANTHROPIC_API_KEY
npm start
```

Runs on `http://localhost:8788`.

Frontend: same as `bank-copilot` — drop `chat.component.ts/html/scss` and `chat.service.ts` into an Angular workspace, render `<app-chat>`.

## Extending

- Tune retrieval: `TOP_K` and `MIN_SIMILARITY` are in `retrieve.js`.
- Tune chunking: `chunkSize` / `overlap` defaults are in `chunk.js`.
- Stretch: bilingual documents (AR/EN — would need a multilingual embedding model, `all-MiniLM-L6-v2` is English-only), hybrid retrieval (combine with `bank-copilot`'s structured tools for a single assistant that can both look up your balance and explain the fee policy).
