import * as pdfjsLib from "pdfjs-dist";

// Worker (CDN pinned to installed version)
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

export async function loadPdfDocument(data) {
  const task = pdfjsLib.getDocument({ data });
  return task.promise;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// --- rotation helpers (clockwise) ---
export function drawWithRotation(ctx, rot, w, h, fn) {
  ctx.save();
  if (rot === 90) {
    ctx.translate(h, 0);
    ctx.rotate(Math.PI / 2);
  } else if (rot === 180) {
    ctx.translate(w, h);
    ctx.rotate(Math.PI);
  } else if (rot === 270) {
    ctx.translate(0, w);
    ctx.rotate((3 * Math.PI) / 2);
  }
  fn();
  ctx.restore();
}

// map a display point (X,Y) back to unrotated page pixels (px,py)
export function unrotatePoint(X, Y, rot, w, h) {
  if (rot === 90) return { px: Y, py: h - X };
  if (rot === 180) return { px: w - X, py: h - Y };
  if (rot === 270) return { px: w - Y, py: X };
  return { px: X, py: Y };
}

export function rotatedDims(w, h, rot) {
  const rotated = rot === 90 || rot === 270;
  return { dw: rotated ? h : w, dh: rotated ? w : h };
}

function paintBlankPattern(ctx, page, w, h) {
  const style = page.lineStyle || "blank";
  ctx.strokeStyle = "#d7dbe0";
  ctx.lineWidth = 1;
  const gap = Math.max(18, h / 34);
  if (style === "ruled") {
    for (let y = gap; y < h; y += gap) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  } else if (style === "grid") {
    for (let y = gap; y < h; y += gap) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let x = gap; x < w; x += gap) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  } else if (style === "dotted") {
    ctx.fillStyle = "#c4c9d0";
    for (let y = gap; y < h; y += gap) {
      for (let x = gap; x < w; x += gap) {
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

async function loadFontImage() {}

export async function paintBase(ctx, canvas, page, sources, scale) {
  const W = page.width;
  const H = page.height;
  const rot = page.rotation || 0;
  const w = W * scale;
  const h = H * scale;
  const { dw, dh } = rotatedDims(w, h, rot);
  canvas.width = Math.max(1, Math.round(dw));
  canvas.height = Math.max(1, Math.round(dh));

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (page.kind === "pdf" && sources[page.srcId]) {
    const pg = await sources[page.srcId].getPage(page.pdfIndex);
    const viewport = pg.getViewport({ scale, rotation: rot });
    await pg.render({ canvasContext: ctx, viewport }).promise;
  } else if (page.kind === "image" && page.imageDataUrl) {
    const img = await loadImage(page.imageDataUrl);
    drawWithRotation(ctx, rot, w, h, () => {
      const s = Math.min(w / img.width, h / img.height);
      const iw = img.width * s;
      const ih = img.height * s;
      ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
    });
  } else {
    drawWithRotation(ctx, rot, w, h, () => paintBlankPattern(ctx, page, w, h));
  }
  return { dw: canvas.width, dh: canvas.height, w, h, rot };
}

function drawStroke(ctx, a, scale) {
  const pts = a.points;
  if (!pts || pts.length === 0) return;
  ctx.save();
  ctx.globalAlpha = a.opacity ?? 1;
  ctx.strokeStyle = a.color;
  ctx.lineJoin = "round";
  ctx.lineCap = a.tool === "highlighter" ? "butt" : "round";
  ctx.lineWidth = a.size * scale;
  if (a.tool === "highlighter") ctx.globalCompositeOperation = "multiply";
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * scale, pts[0][1] * scale);
  if (pts.length === 1) {
    ctx.lineTo(pts[0][0] * scale + 0.1, pts[0][1] * scale + 0.1);
  } else {
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0] * scale, pts[i][1] * scale);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function drawShape(ctx, a, scale) {
  ctx.save();
  ctx.globalAlpha = a.opacity ?? 1;
  ctx.strokeStyle = a.color;
  ctx.fillStyle = a.color;
  ctx.lineWidth = a.size * scale;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const x1 = a.x1 * scale;
  const y1 = a.y1 * scale;
  const x2 = a.x2 * scale;
  const y2 = a.y2 * scale;
  if (a.shape === "rect") {
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  } else if (a.shape === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(
      (x1 + x2) / 2,
      (y1 + y2) / 2,
      Math.abs(x2 - x1) / 2,
      Math.abs(y2 - y1) / 2,
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  } else if (a.shape === "line" || a.shape === "arrow") {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    if (a.shape === "arrow") {
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const head = Math.max(10, a.size * scale * 3);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - head * Math.cos(ang - Math.PI / 6),
        y2 - head * Math.sin(ang - Math.PI / 6)
      );
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - head * Math.cos(ang + Math.PI / 6),
        y2 - head * Math.sin(ang + Math.PI / 6)
      );
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawText(ctx, a, scale) {
  ctx.save();
  ctx.globalAlpha = a.opacity ?? 1;
  ctx.fillStyle = a.color;
  const fs = (a.fontSize || 16) * scale;
  ctx.font = `${fs}px 'IBM Plex Sans', sans-serif`;
  ctx.textBaseline = "top";
  const lines = String(a.text || "").split("\n");
  lines.forEach((ln, i) => {
    ctx.fillText(ln, a.x * scale, a.y * scale + i * fs * 1.25);
  });
  ctx.restore();
}

function drawLink(ctx, a, scale) {
  ctx.save();
  ctx.fillStyle = a.color || "#3B82F6";
  const fs = (a.fontSize || 15) * scale;
  ctx.font = `${fs}px 'IBM Plex Sans', sans-serif`;
  ctx.textBaseline = "top";
  const label = a.label || a.url;
  const tw = ctx.measureText(label).width;
  ctx.fillText(label, a.x * scale, a.y * scale);
  ctx.strokeStyle = a.color || "#3B82F6";
  ctx.lineWidth = Math.max(1, scale);
  ctx.beginPath();
  ctx.moveTo(a.x * scale, a.y * scale + fs * 1.05);
  ctx.lineTo(a.x * scale + tw, a.y * scale + fs * 1.05);
  ctx.stroke();
  ctx.restore();
}

export function paintAnnotations(ctx, page, scale, extra) {
  const W = page.width;
  const H = page.height;
  const rot = page.rotation || 0;
  const w = W * scale;
  const h = H * scale;
  const all = extra ? [...page.annotations, extra] : page.annotations;
  drawWithRotation(ctx, rot, w, h, () => {
    for (const a of all) {
      if (a.type === "stroke") drawStroke(ctx, a, scale);
      else if (a.type === "shape") drawShape(ctx, a, scale);
      else if (a.type === "text") drawText(ctx, a, scale);
      else if (a.type === "link") drawLink(ctx, a, scale);
    }
  });
}

// composite render (base + annotations) into a canvas — used by thumbnails + export
export async function renderComposite(canvas, page, sources, scale) {
  const ctx = canvas.getContext("2d");
  await paintBase(ctx, canvas, page, sources, scale);
  paintAnnotations(ctx, page, scale);
  return canvas;
}

// hit test in unrotated page-point space
export function annotationHit(a, px, py, tol) {
  if (a.type === "stroke") {
    return a.points.some((p) => Math.hypot(p[0] - px, p[1] - py) <= tol + (a.size || 2));
  }
  if (a.type === "shape") {
    const minx = Math.min(a.x1, a.x2) - tol;
    const maxx = Math.max(a.x1, a.x2) + tol;
    const miny = Math.min(a.y1, a.y2) - tol;
    const maxy = Math.max(a.y1, a.y2) + tol;
    return px >= minx && px <= maxx && py >= miny && py <= maxy;
  }
  if (a.type === "text" || a.type === "link") {
    return (
      px >= a.x - tol &&
      px <= a.x + (a.w || 160) + tol &&
      py >= a.y - tol &&
      py <= a.y + (a.h || 24) + tol
    );
  }
  return false;
}
