import { PDFDocument } from "pdf-lib";
import { renderComposite } from "./pdfEngine";

async function pageToPng(page, sources, scale) {
  const canvas = document.createElement("canvas");
  await renderComposite(canvas, page, sources, scale);
  const dataUrl = canvas.toDataURL("image/png");
  const bytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
  return new Uint8Array(bytes);
}

// Build a raster (WYSIWYG) PDF from the page list. exportScale controls quality.
export async function buildPdf(pages, sources, exportScale = 2) {
  const doc = await PDFDocument.create();
  for (const page of pages) {
    const png = await pageToPng(page, sources, exportScale);
    const embedded = await doc.embedPng(png);
    const rotated = page.rotation === 90 || page.rotation === 270;
    const ptW = rotated ? page.height : page.width;
    const ptH = rotated ? page.width : page.height;
    const p = doc.addPage([ptW, ptH]);
    p.drawImage(embedded, { x: 0, y: 0, width: ptW, height: ptH });
  }
  return doc.save();
}

export function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportPages(pages, sources, filename) {
  const bytes = await buildPdf(pages, sources);
  downloadBytes(bytes, filename);
}
