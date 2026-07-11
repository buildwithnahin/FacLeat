import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const root = process.cwd();
const inputPath = path.join(root, 'reports', 'chart-of-accounts-documentation.md');
const outputPath = path.join(root, 'reports', 'chart-of-accounts-documentation.pdf');

const text = fs.readFileSync(inputPath, 'utf8').replace(/\r\n/g, '\n');

const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 42;
const contentWidth = pageWidth - margin * 2;
const baseFontSize = 10;
const baseLineHeight = 14;

let page = pdf.addPage([pageWidth, pageHeight]);
let y = pageHeight - margin;

function ensureSpace(required = baseLineHeight) {
  if (y - required < margin) {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  }
}

function wrapLine(line, activeFont, size, indent = 0) {
  if (line.length === 0) return [''];
  const availableWidth = contentWidth - indent;
  const words = line.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = activeFont.widthOfTextAtSize(candidate, size);
    if (width <= availableWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
      continue;
    }

    let fragment = '';
    for (const ch of word) {
      const next = fragment + ch;
      if (activeFont.widthOfTextAtSize(next, size) <= availableWidth) {
        fragment = next;
      } else {
        lines.push(fragment);
        fragment = ch;
      }
    }
    current = fragment;
  }

  if (current) lines.push(current);
  return lines;
}

function drawWrappedText(line, options = {}) {
  const {
    activeFont = font,
    size = baseFontSize,
    color = rgb(0.1, 0.1, 0.1),
    indent = 0,
    before = 0,
    after = 0,
  } = options;

  y -= before;
  const wrapped = wrapLine(line, activeFont, size, indent);
  for (const wrappedLine of wrapped) {
    ensureSpace(baseLineHeight);
    page.drawText(wrappedLine, {
      x: margin + indent,
      y,
      size,
      font: activeFont,
      color,
    });
    y -= baseLineHeight;
  }
  y -= after;
}

for (const rawLine of text.split('\n')) {
  const trimmed = rawLine.trim();

  if (rawLine.startsWith('# ')) {
    drawWrappedText(rawLine.slice(2), {
      activeFont: bold,
      size: 18,
      color: rgb(0.05, 0.05, 0.05),
      before: 4,
      after: 4,
    });
    continue;
  }

  if (rawLine.startsWith('## ')) {
    drawWrappedText(rawLine.slice(3), {
      activeFont: bold,
      size: 13,
      color: rgb(0.08, 0.08, 0.08),
      before: 2,
      after: 2,
    });
    continue;
  }

  if (trimmed === '') {
    y -= 6;
    continue;
  }

  if (/^\d+\.\s/.test(trimmed)) {
    drawWrappedText(trimmed, { indent: 10 });
    continue;
  }

  if (trimmed.startsWith('- ')) {
    drawWrappedText(trimmed, { indent: 10 });
    continue;
  }

  drawWrappedText(rawLine);
}

const bytes = await pdf.save();
fs.writeFileSync(outputPath, bytes);

console.log(outputPath);
