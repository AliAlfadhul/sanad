const { PDFParse } = require('pdf-parse');

async function parsePdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text.replace(/--\s*\d+\s*of\s*\d+\s*--/g, '').trim();
}

module.exports = { parsePdf };
