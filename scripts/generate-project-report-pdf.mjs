import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const root = process.cwd();
const inputPath = path.join(root, 'reports', 'annex-erp-project-report.md');
const outputPath = path.join(root, 'reports', 'annex-erp-project-report.pdf');

const text = fs.readFileSync(inputPath, 'utf8').replace(/\r\n/g, '\n');

const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 46;
const contentWidth = pageWidth - margin * 2;
const fontSize = 10;
const lineHeight = 14;

function wrapLine(line, activeFont, size) {
  if (line.length === 0) return [''];
  const words = line.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = activeFont.widthOfTextAtSize(candidate, size);
    if (width <= contentWidth) {
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
      if (activeFont.widthOfTextAtSize(next, size) <= contentWidth) {
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

let page = pdf.addPage([pageWidth, pageHeight]);
let y = pageHeight - margin;

function ensureSpace(required = lineHeight) {
  if (y - required < margin) {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  }
}

function drawText(line, activeFont = font, size = fontSize, color = rgb(0.1, 0.1, 0.1)) {
  ensureSpace(lineHeight);
  page.drawText(line, {
    x: margin,
    y,
    size,
    font: activeFont,
    color,
  });
  y -= lineHeight;
}

for (const rawLine of text.split('\n')) {
  if (rawLine.startsWith('# ')) {
    y -= 4;
    for (const line of wrapLine(rawLine.replace(/^# /, ''), bold, 18)) {
      drawText(line, bold, 18, rgb(0.05, 0.05, 0.05));
    }
    y -= 4;
    continue;
  }

  if (rawLine.startsWith('## ')) {
    y -= 2;
    for (const line of wrapLine(rawLine.replace(/^## /, ''), bold, 14)) {
      drawText(line, bold, 14, rgb(0.08, 0.08, 0.08));
    }
    y -= 2;
    continue;
  }

  if (rawLine.startsWith('### ')) {
    y -= 2;
    for (const line of wrapLine(rawLine.replace(/^### /, ''), bold, 12)) {
      drawText(line, bold, 12, rgb(0.1, 0.1, 0.1));
    }
    continue;
  }

  if (rawLine.trim() === '') {
    y -= 6;
    continue;
  }

  const activeFont = rawLine.startsWith('- ') || /^\d+\./.test(rawLine) ? font : font;
  for (const line of wrapLine(rawLine, activeFont, fontSize)) {
    drawText(line, activeFont, fontSize);
  }
}

const bytes = await pdf.save();
fs.writeFileSync(outputPath, bytes);

console.log(outputPath);
