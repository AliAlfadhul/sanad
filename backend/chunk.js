function splitIntoSections(raw) {
  const lines = raw.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^##\s+(.*)/);
    if (match) {
      if (current) sections.push(current);
      current = { heading: match[1].trim(), text: '' };
    } else if (current) {
      current.text += line + '\n';
    }
  }
  if (current) sections.push(current);
  return sections;
}

function splitWords(text, size, overlap) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= size) return [words.join(' ')];

  const windows = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + size, words.length);
    windows.push(words.slice(start, end).join(' '));
    if (end === words.length) break;
    start += size - overlap;
  }
  return windows;
}

function chunkDocument(raw, docId, docTitle, { chunkSize = 150, overlap = 30 } = {}) {
  let sections = splitIntoSections(raw);

  if (sections.length === 0) {
    const body = raw.replace(/^#\s+.*\n?/, '');
    sections = [{ heading: docTitle, text: body }];
  }

  const chunks = [];

  sections.forEach((section, sIndex) => {
    const windows = splitWords(section.text, chunkSize, overlap);
    windows.forEach((text, wIndex) => {
      chunks.push({
        id: `${docId}-s${sIndex}-c${wIndex}`,
        docId,
        docTitle,
        sectionTitle: section.heading,
        text: text.trim(),
        chunkIndex: wIndex
      });
    });
  });

  return chunks;
}

module.exports = { chunkDocument, splitIntoSections, splitWords };
