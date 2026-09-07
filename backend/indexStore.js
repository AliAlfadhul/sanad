const fs = require('fs');
const path = require('path');

const INDEX_FILE = path.join(__dirname, 'data', 'index.json');

let cache = null;

function load() {
  if (!cache) {
    cache = fs.existsSync(INDEX_FILE) ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8')) : [];
  }
  return cache;
}

function save(chunks) {
  cache = chunks;
  fs.writeFileSync(INDEX_FILE, JSON.stringify(chunks));
}

function addOrReplace(docId, newChunks) {
  const rest = load().filter(c => c.docId !== docId);
  save([...rest, ...newChunks]);
}

module.exports = { load, save, addOrReplace };
