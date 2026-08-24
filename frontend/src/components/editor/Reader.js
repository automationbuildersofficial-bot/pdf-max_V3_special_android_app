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

export default function Reader({ doc, viewMode, setActivePage, onCommit, toolState }) {
  const { pages, sources, scale, activePageId } = doc;
  const { tool, color, size, opacity, straight } = toolState;
  const containerRef = useRef(null);
  const visibleRef = useRef(new Set());
  const ratios = useRef(new Map());
  const fromObserver = useRef(false);
  const activateRef = useRef(setActivePage);
  const [, tick] = useState(0);
  activateRef.current = setActivePage;

  const single = viewMode === "single";

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
        if (best && best !== activePageId) {
          fromObserver.current = true;
          activateRef.current(best);
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
