import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  paintBase,
  paintAnnotations,
  unrotatePoint,
  rotatedDims,
  annotationHit,
} from "@/lib/pdfEngine";
import { DRAW_TOOLS, SHAPE_TOOLS } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

let uid = 0;
const newId = () => `a${Date.now()}_${uid++}`;

export default function PageView({
  page,
  sources,
  scale,
  tool,
  color,
  size,
  opacity,
  straight,
  onCommit,
  inView = true,
  onActivate,
  pageNumber,
}) {
  const baseRef = useRef(null);
  const annRef = useRef(null);
  const drawing = useRef(false);
  const [draft, setDraft] = useState(null);
  const removed = useRef(new Set());
  const [, force] = useState(0);
  const [textDlg, setTextDlg] = useState(null);
  const [linkDlg, setLinkDlg] = useState(null);

  const w = page.width * scale;
  const h = page.height * scale;
  const rot = page.rotation || 0;
  const { dw, dh } = rotatedDims(w, h, rot);

  // render base (lazy: only when in view)
  useEffect(() => {
    if (!inView) return;
    (async () => {
      const canvas = baseRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      try {
        await paintBase(ctx, canvas, page, sources, scale);
      } catch (e) {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, page.id, page.kind, page.pdfIndex, page.imageDataUrl, page.lineStyle, rot, scale, sources]);

  // render annotations
  useEffect(() => {
    const canvas = annRef.current;
    if (!canvas) return;
    canvas.width = Math.round(dw);
    canvas.height = Math.round(dh);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const visible = {
      ...page,
      annotations: page.annotations.filter((a) => !removed.current.has(a.id)),
    };
    paintAnnotations(ctx, visible, scale, draft);
  }, [page, draft, scale, dw, dh]);

  const toPage = useCallback(
    (e) => {
      const rect = annRef.current.getBoundingClientRect();
      const X = e.clientX - rect.left;
      const Y = e.clientY - rect.top;
      const { px, py } = unrotatePoint(X, Y, rot, w, h);
      return [px / scale, py / scale];
    },
    [rot, w, h, scale]
  );

  const eraseAt = (pt) => {
    const tol = 8 / scale;
    let changed = false;
    for (const a of page.annotations) {
      if (!removed.current.has(a.id) && annotationHit(a, pt[0], pt[1], tol)) {
        removed.current.add(a.id);
        changed = true;
      }
    }
    if (changed) force((n) => n + 1);
  };

  const onDown = (e) => {
    onActivate?.();
    const pt = toPage(e);
    if (tool === "select") {
      const tol = 6 / scale;
      const hit = [...page.annotations]
        .reverse()
        .find((a) => a.type === "link" && annotationHit(a, pt[0], pt[1], tol));
      if (hit) window.open(hit.url, "_blank", "noopener");
      return;
    }
    if (tool === "text") {
      setTextDlg({ x: pt[0], y: pt[1], value: "" });
      return;
    }
    if (tool === "link") {
      setLinkDlg({ x: pt[0], y: pt[1], url: "", label: "" });
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    if (tool === "eraser") {
      removed.current = new Set();
      eraseAt(pt);
      return;
    }
    if (DRAW_TOOLS.includes(tool)) {
      setDraft({ id: newId(), type: "stroke", tool, color, size, opacity, points: [pt] });
    } else if (SHAPE_TOOLS.includes(tool)) {
      setDraft({
        id: newId(),
        type: "shape",
        shape: tool,
        color,
        size,
        opacity: 1,
        x1: pt[0],
        y1: pt[1],
        x2: pt[0],
        y2: pt[1],
      });
    }
  };

  const onMove = (e) => {
    if (!drawing.current) return;
    const pt = toPage(e);
    if (tool === "eraser") {
      eraseAt(pt);
      return;
    }
    if (DRAW_TOOLS.includes(tool)) {
      setDraft((d) => {
        if (!d) return d;
        if (straight) return { ...d, points: [d.points[0], pt] };
        return { ...d, points: [...d.points, pt] };
      });
    } else if (SHAPE_TOOLS.includes(tool)) {
      setDraft((d) => (d ? { ...d, x2: pt[0], y2: pt[1] } : d));
    }
  };

  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (tool === "eraser") {
      if (removed.current.size > 0) {
        const keep = page.annotations.filter((a) => !removed.current.has(a.id));
        removed.current = new Set();
        onCommit(page.id, keep);
      }
      return;
    }
    if (draft) {
      const d = draft;
      setDraft(null);
      if (d.type === "shape" && Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 2) return;
      onCommit(page.id, [...page.annotations, d]);
    }
  };

  const cursor = tool === "select" ? "default" : tool === "eraser" ? "cell" : "crosshair";

  return (
    <>
      <div
        className="relative shadow-xl rounded-sm bg-white shrink-0"
        style={{ width: dw, height: dh }}
        data-testid="page-canvas-wrap"
        data-page-id={page.id}
      >
        {pageNumber != null && (
          <span className="absolute -top-6 left-0 text-xs font-medium text-muted-foreground select-none">
            Page {pageNumber}
          </span>
        )}
        <canvas ref={baseRef} className="absolute inset-0 rounded-sm" />
        <canvas
          ref={annRef}
          className="absolute inset-0 rounded-sm"
          style={{ cursor, touchAction: tool === "select" ? "auto" : "none" }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          data-testid="annotation-canvas"
        />
      </div>

      <Dialog open={!!textDlg} onOpenChange={(v) => !v && setTextDlg(null)}>
        <DialogContent className="sm:max-w-md" data-testid="text-comment-dialog">
          <DialogHeader>
            <DialogTitle>Add text comment</DialogTitle>
          </DialogHeader>
          <Textarea
            autoFocus
            placeholder="Type your note…"
            value={textDlg?.value || ""}
            onChange={(e) => setTextDlg((d) => ({ ...d, value: e.target.value }))}
            data-testid="text-comment-input"
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTextDlg(null)}>
              Cancel
            </Button>
            <Button
              data-testid="text-comment-save"
              onClick={() => {
                const v = (textDlg.value || "").trim();
                if (v) {
                  onCommit(page.id, [
                    ...page.annotations,
                    {
                      id: newId(),
                      type: "text",
                      x: textDlg.x,
                      y: textDlg.y,
                      text: v,
                      color,
                      fontSize: Math.max(12, 12 + size),
                    },
                  ]);
                }
                setTextDlg(null);
              }}
            >
              Add comment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!linkDlg} onOpenChange={(v) => !v && setLinkDlg(null)}>
        <DialogContent className="sm:max-w-md" data-testid="link-dialog">
          <DialogHeader>
            <DialogTitle>Add website link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="https://example.com"
              value={linkDlg?.url || ""}
              onChange={(e) => setLinkDlg((d) => ({ ...d, url: e.target.value }))}
              data-testid="link-url-input"
            />
            <Input
              placeholder="Label (optional)"
              value={linkDlg?.label || ""}
              onChange={(e) => setLinkDlg((d) => ({ ...d, label: e.target.value }))}
              data-testid="link-label-input"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkDlg(null)}>
              Cancel
            </Button>
            <Button
              data-testid="link-save"
              onClick={() => {
                let url = (linkDlg.url || "").trim();
                if (!url) return setLinkDlg(null);
                if (!/^https?:\/\//i.test(url)) url = "https://" + url;
                const label = (linkDlg.label || "").trim() || url;
                onCommit(page.id, [
                  ...page.annotations,
                  {
                    id: newId(),
                    type: "link",
                    x: linkDlg.x,
                    y: linkDlg.y,
                    url,
                    label,
                    color: "#3B82F6",
                    fontSize: Math.max(13, 12 + size),
                    w: label.length * 8,
                    h: 20,
                  },
                ]);
                setLinkDlg(null);
              }}
            >
              Add link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
