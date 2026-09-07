const fs = require('fs');
const path = require('path');
const { ingestDocument } = require('./ingestDocument');
const { parsePdf } = require('./parsePdf');
const indexStore = require('./indexStore');

const DOCS_DIR = path.join(__dirname, 'data', 'documents');

async function readDocument(file) {
  const filePath = path.join(DOCS_DIR, file);

  if (file.endsWith('.pdf')) {
    const buffer = fs.readFileSync(filePath);
    const text = await parsePdf(buffer);
    const title = file.replace(/\.pdf$/i, '');
    return `# ${title}\n\n${text}`;
  }

  return fs.readFileSync(filePath, 'utf-8');
}

async function run() {
  const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.md') || f.endsWith('.pdf'));
  let allChunks = [];

  for (const file of files) {
    console.log(`Ingesting ${file}...`);
    const raw = await readDocument(file);
    const chunks = await ingestDocument(file, raw);
    allChunks = allChunks.concat(chunks);
  }

  indexStore.save(allChunks);
  console.log(`Wrote index with ${allChunks.length} chunks.`);
}

run().catch(err => {
  console.error('Ingest failed:', err.message);
  process.exit(1);
});
