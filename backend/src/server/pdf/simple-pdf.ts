import 'server-only';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface PdfTable {
  headers: string[];
  rows: Array<Array<string | number>>;
}

export interface PdfSection {
  title: string;
  rows?: Array<[string, string | number]>;
  table?: PdfTable;
}

export interface SimplePdfInput {
  title: string;
  subtitle?: string;
  sections: PdfSection[];
}

const pageSize = { width: 595.28, height: 841.89 };
const margin = 42;

function asText(value: string | number) {
  return String(value ?? '');
}

function fitText(value: string, maxChars: number) {
  return value.length > maxChars ? `${value.slice(0, maxChars - 1)}…` : value;
}

export async function createSimplePdf(input: SimplePdfInput) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([pageSize.width, pageSize.height]);
  let y = pageSize.height - margin;

  const addPage = () => {
    page = doc.addPage([pageSize.width, pageSize.height]);
    y = pageSize.height - margin;
  };

  const ensure = (height: number) => {
    if (y - height < margin) addPage();
  };

  const text = (value: string, x: number, size = 10, weight = font) => {
    page.drawText(value, { x, y, size, font: weight, color: rgb(0.08, 0.09, 0.11) });
  };

  text(input.title, margin, 18, bold);
  y -= 22;
  if (input.subtitle) {
    text(input.subtitle, margin, 10);
    y -= 18;
  }
  y -= 6;

  for (const section of input.sections) {
    ensure(46);
    text(section.title, margin, 13, bold);
    y -= 18;

    if (section.rows) {
      for (const [label, value] of section.rows) {
        ensure(16);
        text(fitText(label, 45), margin, 9, bold);
        text(fitText(asText(value), 70), margin + 210, 9);
        y -= 14;
      }
      y -= 8;
    }

    if (section.table) {
      const usableWidth = pageSize.width - margin * 2;
      const colWidth = usableWidth / section.table.headers.length;
      ensure(28);
      page.drawRectangle({
        x: margin,
        y: y - 5,
        width: usableWidth,
        height: 18,
        color: rgb(0.94, 0.95, 0.97),
      });
      section.table.headers.forEach((header, i) => {
        page.drawText(fitText(header, Math.floor(colWidth / 5)), {
          x: margin + i * colWidth + 4,
          y,
          size: 8,
          font: bold,
          color: rgb(0.17, 0.2, 0.25),
        });
      });
      y -= 18;

      for (const row of section.table.rows) {
        ensure(16);
        row.forEach((cell, i) => {
          page.drawText(fitText(asText(cell), Math.floor(colWidth / 5)), {
            x: margin + i * colWidth + 4,
            y,
            size: 8,
            font,
            color: rgb(0.08, 0.09, 0.11),
          });
        });
        y -= 14;
      }
      y -= 10;
    }
  }

  return doc.save();
}

export function pdfResponse(filename: string, bytes: Uint8Array) {
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}
