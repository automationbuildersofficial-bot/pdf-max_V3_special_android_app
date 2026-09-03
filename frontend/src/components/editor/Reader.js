import React, { useRef, useEffect, useState, useCallback } from "react";
import PageView from "@/components/editor/PageView";

function buildSpreads(pages) {
  // book layout: first page alone (cover), then pairs
  const spreads = [];
  if (!pages.length) return spreads;
  spreads.push([pages[0]]);
  for (let i = 1; i < pages.length; i += 2) {
    spreads.push(pages.slice(i, i + 2));
  }
  return spreads;
}

export default function Reader({ doc, viewMode, setActivePage, setScale, onCommit, toolState }) {
  const { pages, sources, scale, activePageId } = doc;
  const { tool, color, size, opacity, straight } = toolState;
  const containerRef = useRef(null);
  const visibleRef = useRef(new Set());
  const ratios = useRef(new Map());
  const fromObserver = useRef(false);
  const activateRef = useRef(setActivePage);
  const [, tick] = useState(0);
  activateRef.current = setActivePage;

  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const setScaleRef = useRef(setScale);
  setScaleRef.current = setScale;
  const pinch = useRef(null);
  const activePageIdRef = useRef(activePageId);
  activePageIdRef.current = activePageId;
  const rafRef = useRef(0);

  const single = viewMode === "single";

  // pinch-to-zoom on touch devices — adjusts the document scale.
  // The non-passive touchmove listener is attached ONLY while a 2-finger pinch is active,
  // so single-finger scrolling stays on the browser's fast (passive) path and doesn't lag.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const dist = (t) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onMove = (e) => {
      if (e.touches.length === 2 && pinch.current) {
        e.preventDefault();
        const ratio = dist(e.touches) / pinch.current.d;
        const ns = Math.max(0.4, Math.min(4, pinch.current.s * ratio));
        setScaleRef.current?.(ns);
      }
    };
    const onStart = (e) => {
      if (e.touches.length === 2) {
        pinch.current = { d: dist(e.touches) || 1, s: scaleRef.current };
        el.addEventListener("touchmove", onMove, { passive: false });
      }
    };
    const onEnd = (e) => {
      if (e.touches.length < 2) {
        pinch.current = null;
        el.removeEventListener("touchmove", onMove, { passive: false });
      }
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [viewMode]);

  // IntersectionObserver for lazy paint + active-page tracking (scroll & book modes)
  useEffect(() => {
    if (single) return;
    const root = containerRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        let changed = false;
        entries.forEach((en) => {
          const id = en.target.getAttribute("data-page-id");
          ratios.current.set(id, en.intersectionRatio);
          if (en.isIntersecting && !visibleRef.current.has(id)) {
            visibleRef.current.add(id);
            changed = true;
          }
        });
        let best = null;
        let bestR = -1;
        ratios.current.forEach((r, id) => {
          if (r > bestR) {
            bestR = r;
            best = id;
          }
        });
        if (best && best !== activePageIdRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(() => {
            if (best !== activePageIdRef.current) {
              fromObserver.current = true;
              activateRef.current(best);
            }
          });
        }
        if (changed) tick((n) => n + 1);
      },
      { root, threshold: [0, 0.15, 0.4, 0.7, 1] }
    );
    root.querySelectorAll("[data-page-id]").forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, viewMode, scale]);

  // scroll to active page when changed externally (thumbnail click, prev/next)
  useEffect(() => {
    if (single) return;
    if (fromObserver.current) {
      fromObserver.current = false;
      return;
    }
    const root = containerRef.current;
    if (!root || !activePageId) return;
    const el = root.querySelector(`[data-page-id="${activePageId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId, viewMode]);

  const pv = (page) => {
    const idx = pages.findIndex((p) => p.id === page.id);
    return (
      <PageView
        key={page.id}
        page={page}
        sources={sources}
        scale={scale}
        tool={tool}
        color={color}
        size={size}
        opacity={opacity}
        straight={straight}
        onCommit={onCommit}
        inView={single ? true : visibleRef.current.has(page.id) || page.id === activePageId}
        onActivate={() => {
          fromObserver.current = true;
          setActivePage(page.id);
        }}
        pageNumber={idx + 1}
      />
    );
  };

  if (single) {
    const active = pages.find((p) => p.id === activePageId) || pages[0];
    return (
      <div
        ref={containerRef}
        data-testid="reader-single"
        className="h-full w-full overflow-auto canvas-scroll flex justify-center items-start py-10 px-4"
      >
        {active && pv(active)}
      </div>
    );
  }

  if (viewMode === "book") {
    const spreads = buildSpreads(pages);
    return (
      <div
        ref={containerRef}
        data-testid="reader-book"
        className="h-full w-full overflow-auto canvas-scroll flex flex-col items-center gap-10 py-10 px-4"
      >
        {spreads.map((sp, i) => (
          <div key={i} className="flex gap-2 items-start shrink-0">
            {sp.map((p) => pv(p))}
          </div>
        ))}
      </div>
    );
  }

  // continuous scroll (default)
  return (
    <div
      ref={containerRef}
      data-testid="reader-scroll"
      className="h-full w-full overflow-auto canvas-scroll flex flex-col items-center gap-8 py-10 px-4"
    >
      {pages.map((p) => pv(p))}
    </div>
  );
}
