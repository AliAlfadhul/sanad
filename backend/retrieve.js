const { embedText, cosineSimilarity } = require('./embeddings');
const indexStore = require('./indexStore');

const TOP_K = 4;
const MIN_SIMILARITY = 0.3;

async function retrieve(query) {
  const chunks = indexStore.load();
  if (chunks.length === 0) throw new Error('No index found. Run "npm run ingest" first.');

  const queryVector = await embedText(query);

  const scored = chunks
    .map(chunk => ({ ...chunk, score: cosineSimilarity(queryVector, chunk.vector) }))
    .sort((a, b) => b.score - a.score);

  return scored
    .slice(0, TOP_K)
    .filter(c => c.score >= MIN_SIMILARITY)
    .map(({ vector, ...rest }) => rest);
}

function listDocuments() {
  const chunks = indexStore.load();
  const seen = new Map();
  chunks.forEach(c => seen.set(c.docId, c.docTitle));
  return Array.from(seen, ([id, title]) => ({ id, title }));
}

module.exports = { retrieve, listDocuments };
