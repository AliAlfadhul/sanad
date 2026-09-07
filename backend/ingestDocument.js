const { chunkDocument } = require('./chunk');
const { embedText } = require('./embeddings');

async function ingestDocument(docId, rawText) {
  const docTitle = rawText.split('\n')[0].replace(/^#\s*/, '').trim() || docId;
  const chunks = chunkDocument(rawText, docId, docTitle);

  for (const chunk of chunks) {
    chunk.vector = await embedText(chunk.text);
  }

  return chunks;
}

module.exports = { ingestDocument };
