require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { retrieve, listDocuments } = require('./retrieve');
const { ingestDocument } = require('./ingestDocument');
const { parsePdf } = require('./parsePdf');
const indexStore = require('./indexStore');

const DOCS_DIR = path.join(__dirname, 'data', 'documents');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-6';

function buildSystemPrompt(contextBlocks) {
  const excerpts = contextBlocks
    .map((c, i) => `[${i + 1}] ${c.docTitle} — ${c.sectionTitle}\n${c.text}`)
    .join('\n\n');

  return `You are a policy assistant. Answer strictly using the numbered excerpts below, and nothing else, even if you know the real-world answer.

Rules:
- Cite the excerpt number(s) you used for every claim, like [1] or [1][3].
- If the excerpts don't answer the question, say plainly that the policy documents don't cover it. Do not fill the gap from general knowledge.
- Reply in the same language the user wrote in.
- Keep answers short: the direct answer first, citation, then one line of context if needed.

Excerpts:
${excerpts}`;
}

async function addDocumentToIndex(title, content) {
  const docId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
  const raw = `# ${title}\n\n${content}`;
  fs.writeFileSync(path.join(DOCS_DIR, docId), raw);
  const chunks = await ingestDocument(docId, raw);
  indexStore.addOrReplace(docId, chunks);
  return { docId, chunkCount: chunks.length };
}

app.get('/api/documents', (req, res) => {
  try {
    res.json(listDocuments());
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.post('/api/documents', async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title and content are required' });

  try {
    const result = await addDocumentToIndex(title, content);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });
  if (req.file.mimetype !== 'application/pdf') {
    return res.status(400).json({ error: 'only PDF files are supported' });
  }

  try {
    const text = await parsePdf(req.file.buffer);
    if (!text.trim()) {
      return res.status(422).json({
        error: 'Could not extract any text from this PDF. It may be a scanned image, which needs OCR — not supported here.'
      });
    }
    const title = req.file.originalname.replace(/\.pdf$/i, '');
    const result = await addDocumentToIndex(title, text);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const contextBlocks = await retrieve(message);
    send('retrieved', {
      sources: contextBlocks.map(c => ({ docTitle: c.docTitle, sectionTitle: c.sectionTitle, score: c.score }))
    });

    if (contextBlocks.length === 0) {
      send('final', { text: "The policy documents don't cover that." });
      return res.end();
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: buildSystemPrompt(contextBlocks),
        messages: [{ role: 'user', content: message }]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${text}`);
    }

    const result = await response.json();
    const textBlock = result.content.find(b => b.type === 'text');
    send('final', { text: textBlock ? textBlock.text : '' });
  } catch (err) {
    send('error', { message: err.message });
  } finally {
    res.end();
  }
});

const PORT = process.env.PORT || 8788;
app.listen(PORT, () => console.log(`sanad backend on :${PORT}`));
