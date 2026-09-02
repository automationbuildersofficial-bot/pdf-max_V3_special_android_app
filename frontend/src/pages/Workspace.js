import React, { useReducer, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeProvider";
import { loadPdfDocument } from "@/lib/pdfEngine";
import { exportPages, buildPdf, downloadBytes } from "@/lib/exportPdf";
import { deleteFile, putState, getState, deleteState, getRecents, addRecent, removeRecent, updateRecent } from "@/lib/storage";
import TopBar from "@/components/editor/TopBar";
import Sidebar from "@/components/editor/Sidebar";
import Reader from "@/components/editor/Reader";
import Toolbar from "@/components/editor/Toolbar";
import Tabs from "@/components/editor/Tabs";
import StartScreen from "@/components/editor/StartScreen";
import Tutorial from "@/components/editor/Tutorial";
import ImageInsertDialog from "@/components/editor/ImageInsertDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Loader2, PanelLeftOpen } from "lucide-react";

let pid = 0;
const newPageId = () => `p${Date.now()}_${pid++}`;
const newDocId = () => `doc${Date.now()}_${pid++}`;

function makeDoc({ id, name, sources, sourceBlobs, pages, fileHandle, recentId, activePageId, scale }) {
  return {
    id,
    name,
    sources,
    sourceBlobs: sourceBlobs || {},
    pages,
    past: [],
    future: [],
    activePageId: activePageId || pages[0]?.id || null,
    selected: new Set(),
    scale: scale || 1.4,
    fileHandle: fileHandle || null,
    recentId: recentId || null,
  };
}

function reducer(state, action) {
  const { docs } = state;
  const upd = (id, fn) => docs.map((d) => (d.id === id ? fn(d) : d));
  switch (action.type) {
    case "OPEN":
      return { docs: [...docs, action.doc], activeDocId: action.doc.id };
    case "CLOSE": {
      const rest = docs.filter((d) => d.id !== action.id);
      let act = state.activeDocId;
      if (act === action.id) act = rest.length ? rest[rest.length - 1].id : null;
      return { docs: rest, activeDocId: act };
    }
    case "ACTIVATE":
      return { ...state, activeDocId: action.id };
    case "COMMIT":
      return {
        ...state,
        docs: upd(action.id, (d) => ({
          ...d,
          pages: action.pages,
          past: [...d.past, d.pages].slice(-60),
          future: [],
        })),
      };
    case "UNDO":
      return {
        ...state,
        docs: upd(action.id, (d) => {
          if (!d.past.length) return d;
          const prev = d.past[d.past.length - 1];
          return { ...d, pages: prev, past: d.past.slice(0, -1), future: [d.pages, ...d.future] };
        }),
      };
    case "REDO":
      return {
        ...state,
        docs: upd(action.id, (d) => {
          if (!d.future.length) return d;
          const next = d.future[0];
          return { ...d, pages: next, past: [...d.past, d.pages], future: d.future.slice(1) };
        }),
      };
    case "SET_PAGE":
      return { ...state, docs: upd(action.id, (d) => ({ ...d, activePageId: action.pageId })) };
    case "SET_SELECTED":
      return { ...state, docs: upd(action.id, (d) => ({ ...d, selected: action.selected })) };
    case "SET_SCALE":
      return { ...state, docs: upd(action.id, (d) => ({ ...d, scale: action.scale })) };
    case "SET_HANDLE":
      return { ...state, docs: upd(action.id, (d) => ({ ...d, fileHandle: action.handle })) };
    case "REFIT_ALL":
      return { ...state, docs: docs.map((d) => ({ ...d, scale: action.scale })) };
    default:
      return state;
  }
}

export default function Workspace() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  const [{ docs, activeDocId }, dispatch] = useReducer(reducer, { docs: [], activeDocId: null });
  const [recents, setRecents] = useState(() => getRecents());
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [tool, setTool] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "select" : "pen"
  );
  const [color, setColor] = useState("#EF4444");
  const [size, setSize] = useState(4);
  const [opacity, setOpacity] = useState(1);
  const [straight, setStraight] = useState(false);

  const [viewMode, setViewMode] = useState(() => localStorage.getItem("pdf_view_mode") || "scroll");
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return false;
    return localStorage.getItem("pdf_sidebar_open") !== "0";
  });

  const [tut, setTut] = useState({ open: false, step: 0 });
  const [imgDlg, setImgDlg] = useState({ open: false, index: 0 });
  const [splitDlg, setSplitDlg] = useState({ open: false, at: 1 });
  const [saveDlg, setSaveDlg] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved

  const supportsFS = typeof window !== "undefined" && !!window.showOpenFilePicker;

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768
  );
  useEffect(() => {
    const fitScale = () =>
      Math.max(0.4, Math.min(1.6, (window.innerWidth - 40) / 595));
    const onResize = () => {
      setIsMobile(window.innerWidth < 768);
      // auto-refit pages to the new screen width on phones/tablets (e.g. rotate to landscape)
      if (window.innerWidth < 1024) {
        dispatch({ type: "REFIT_ALL", scale: fitScale() });
      }
    };
    const onOrient = () => setTimeout(onResize, 150);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onOrient);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onOrient);
    };
  }, []);
  const initialScale = () =>
    typeof window !== "undefined" && window.innerWidth < 768
      ? Math.max(0.4, (window.innerWidth - 40) / 595)
      : 1.4;

  useEffect(() => {
    if (!localStorage.getItem("pdf_tutorial_done")) setTut({ open: true, step: 0 });
  }, []);
  useEffect(() => localStorage.setItem("pdf_view_mode", viewMode), [viewMode]);
  useEffect(() => localStorage.setItem("pdf_sidebar_open", sidebarOpen ? "1" : "0"), [sidebarOpen]);

  // ---- persist full edit state on-device (debounced) so recents restore exactly ----
  const saveTimers = useRef({});
  const saveDocState = async (d) => {
    if (!d?.recentId) return;
    try {
      await putState(d.recentId, {
        name: d.name,
        activePageId: d.activePageId,
        pages: d.pages,
        sourceBlobs: d.sourceBlobs,
      });
      const cur = getRecents().find((r) => r.id === d.recentId);
      if (cur && cur.pages !== d.pages.length) {
        setRecents(updateRecent(d.recentId, { pages: d.pages.length }));
      }
      setSaveStatus("saved");
    } catch (e) {
      console.warn("Failed to persist edits:", e);
    }
  };
  useEffect(() => {
    docs.forEach((d) => {
      if (!d.recentId) return;
      clearTimeout(saveTimers.current[d.recentId]);
      saveTimers.current[d.recentId] = setTimeout(() => saveDocState(d), 700);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs]);

  const doc = docs.find((d) => d.id === activeDocId) || null;
  const pages = doc?.pages || [];
  const sources = doc?.sources || {};
  const activeIndex = doc ? pages.findIndex((p) => p.id === doc.activePageId) : -1;

  // ---- open / build ----
  const buildPdfPages = async (buf, srcId) => {
    const pdfDoc = await loadPdfDocument(buf);
    const list = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const pg = await pdfDoc.getPage(i);
      const vp = pg.getViewport({ scale: 1, rotation: 0 });
      list.push({
        id: newPageId(),
        kind: "pdf",
        srcId,
        pdfIndex: i,
        width: vp.width,
        height: vp.height,
        rotation: 0,
        annotations: [],
      });
    }
    return { pdfDoc, list };
  };

  const openCore = async (buf, name, { fileHandle, recentId } = {}) => {
    const srcId = "src" + Date.now();
    // pdf.js transfers the underlying ArrayBuffer to its worker, which detaches `buf`.
    // Snapshot the bytes into a Blob BEFORE loading so persistence keeps the real PDF.
    const srcBlob = new Blob([buf.slice()], { type: "application/pdf" });
    const { pdfDoc, list } = await buildPdfPages(buf, srcId);
    const id = newDocId();
    const rid = recentId || id;
    const document = makeDoc({
      id,
      name,
      sources: { [srcId]: pdfDoc },
      sourceBlobs: { [srcId]: srcBlob },
      pages: list,
      fileHandle,
      recentId: rid,
      scale: initialScale(),
    });
    dispatch({ type: "OPEN", doc: document });
    return { rid, count: list.length, docState: document };
  };

  const openFile = async (file, fileHandle) => {
    try {
      setLoading(true);
      const buf = new Uint8Array(await file.arrayBuffer());
      const name = file.name.replace(/\.pdf$/i, "");
      const byteSize = buf.length;
      const { rid, count, docState } = await openCore(buf, name, { fileHandle });
      await saveDocState(docState);
      setRecents(addRecent({ id: rid, name, pages: count, ts: Date.now(), size: byteSize }));
      toast.success(`Opened “${file.name}” · ${count} pages`);
    } catch (e) {
      toast.error("Could not open this PDF.");
    } finally {
      setLoading(false);
    }
  };

  const openRecent = async (r) => {
    const existing = docs.find((d) => d.recentId === r.id);
    if (existing) {
      dispatch({ type: "ACTIVATE", id: existing.id });
      return;
    }
    try {
      setLoading(true);
      const state = await getState(r.id);
      if (!state || !state.pages) {
        toast.error("This file is no longer available on the device.");
        setRecents(removeRecent(r.id));
        return;
      }
      const sources = {};
      for (const [srcId, blob] of Object.entries(state.sourceBlobs || {})) {
        const buf = new Uint8Array(await blob.arrayBuffer());
        sources[srcId] = await loadPdfDocument(buf);
      }
      const document = makeDoc({
        id: newDocId(),
        name: state.name || r.name,
        sources,
        sourceBlobs: state.sourceBlobs || {},
        pages: state.pages,
        activePageId: state.activePageId,
        recentId: r.id,
        scale: initialScale(),
      });
      dispatch({ type: "OPEN", doc: document });
      setSaveStatus("saved");
      setRecents(addRecent({ ...r, pages: state.pages.length, ts: Date.now() }));
    } catch (e) {
      toast.error("Could not reopen this file.");
    } finally {
      setLoading(false);
    }
  };

  const removeRecentFile = async (id) => {
    await deleteState(id);
    await deleteFile(id);
    setRecents(removeRecent(id));
    toast.success("Removed from device — its saved edits were wiped");
  };

  // ---- Web Share Target: open a PDF shared into the installed app from Android's share sheet ----
  const sharedConsumed = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("shared") !== "1" || sharedConsumed.current) return;
    sharedConsumed.current = true;
    (async () => {
      try {
        if (!("caches" in window)) return;
        const cache = await caches.open("pdf-share");
        const res = await cache.match("/__shared_pdf");
        if (res) {
          const blob = await res.blob();
          const name = decodeURIComponent(res.headers.get("X-Filename") || "shared.pdf");
          await cache.delete("/__shared_pdf");
          await openFile(new File([blob], name, { type: "application/pdf" }));
        }
      } catch (e) {
        toast.error("Could not open the shared PDF.");
      } finally {
        window.history.replaceState({}, "", "/app");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const openFromDevice = async () => {
    if (!supportsFS) {
      toast.error("This browser can't access device files directly — use Browse instead.");
      return;
    }
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
        multiple: false,
      });
      const file = await handle.getFile();
      await openFile(file, handle);
    } catch (e) {}
  };

  const mergeFile = async (file) => {
    if (!doc) return;
    try {
      setLoading(true);
      const buf = new Uint8Array(await file.arrayBuffer());
      const srcId = "src" + Date.now();
      const srcBlob = new Blob([buf.slice()], { type: "application/pdf" });
      const { pdfDoc, list } = await buildPdfPages(buf, srcId);
      doc.sources[srcId] = pdfDoc; // sources mutation ok (kept in memory)
      doc.sourceBlobs[srcId] = srcBlob;
      setSaveStatus("saving");
      dispatch({ type: "COMMIT", id: doc.id, pages: [...pages, ...list] });
      toast.success(`Merged ${list.length} pages from “${file.name}”`);
    } catch (e) {
      toast.error("Could not merge this PDF.");
    } finally {
      setLoading(false);
    }
  };

  // ---- per-doc operations ----
  const commit = (nextPages) => {
    setSaveStatus("saving");
    dispatch({ type: "COMMIT", id: doc.id, pages: nextPages });
  };
  const setActivePage = useCallback(
    (pageId) => dispatch({ type: "SET_PAGE", id: activeDocId, pageId }),
    [activeDocId]
  );
  const setScale = (scale) => dispatch({ type: "SET_SCALE", id: doc.id, scale });

  const commitAnnotations = useCallback(
    (pageId, anns) => {
      setSaveStatus("saving");
      dispatch({
        type: "COMMIT",
        id: activeDocId,
        pages: docs.find((d) => d.id === activeDocId).pages.map((p) =>
          p.id === pageId ? { ...p, annotations: anns } : p
        ),
      });
    },
    [activeDocId, docs]
  );

  const rotatePage = (pageId) =>
    commit(pages.map((p) => (p.id === pageId ? { ...p, rotation: ((p.rotation || 0) + 90) % 360 } : p)));

  const deletePage = (pageId) => {
    if (pages.length <= 1) {
      toast.error("A document needs at least one page.");
      return;
    }
    commit(pages.filter((p) => p.id !== pageId));
  };

  const reorder = (from, to) => {
    const next = [...pages];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
  };

  const refSize = () => {
    const ref = pages[Math.min(activeIndex >= 0 ? activeIndex : 0, pages.length - 1)];
    return { width: ref?.width || 595, height: ref?.height || 842 };
  };

  const addPage = (index, kind, lineStyle) => {
    const { width, height } = refSize();
    const page = { id: newPageId(), kind: "blank", lineStyle, width, height, rotation: 0, annotations: [] };
    const next = [...pages];
    next.splice(index, 0, page);
    commit(next);
    setActivePage(page.id);
    toast.success("Blank page inserted");
  };

  const insertImage = (dataUrl, iw, ih) => {
    const width = 595;
    const height = Math.max(200, Math.round((595 * ih) / iw));
    const page = { id: newPageId(), kind: "image", imageDataUrl: dataUrl, width, height, rotation: 0, annotations: [] };
    const next = [...pages];
    next.splice(imgDlg.index, 0, page);
    commit(next);
    setActivePage(page.id);
    toast.success("Image page inserted");
  };

  const toggleSelect = (id) => {
    const n = new Set(doc.selected);
    n.has(id) ? n.delete(id) : n.add(id);
    dispatch({ type: "SET_SELECTED", id: doc.id, selected: n });
  };

  const exportFull = async () => {
    if (!pages.length) return;
    setLoading(true);
    try {
      await exportPages(pages, sources, `${doc.name || "document"}-edited.pdf`);
      toast.success("Exported edited PDF");
    } catch (e) {
      toast.error("Export failed");
    } finally {
      setLoading(false);
    }
  };

  const exportSelected = async () => {
    const sel = pages.filter((p) => doc.selected.has(p.id));
    if (!sel.length) return;
    setLoading(true);
    try {
      await exportPages(sel, sources, `${doc.name || "document"}-extract.pdf`);
      toast.success(`Extracted ${sel.length} pages`);
    } catch (e) {
      toast.error("Extract failed");
    } finally {
      setLoading(false);
    }
  };

  const doSplit = async () => {
    const at = Math.max(1, Math.min(pages.length - 1, splitDlg.at));
    const first = pages.slice(0, at);
    const second = pages.slice(at);
    setSplitDlg({ open: false, at });
    setLoading(true);
    try {
      await exportPages(first, sources, `${doc.name || "document"}-part1.pdf`);
      await exportPages(second, sources, `${doc.name || "document"}-part2.pdf`);
      toast.success(`Split into ${first.length} + ${second.length} pages`);
    } catch (e) {
      toast.error("Split failed");
    } finally {
      setLoading(false);
    }
  };

  const saveToDevice = async () => {
    setSaveDlg(false);
    if (!doc || !pages.length) return;
    setLoading(true);
    try {
      const bytes = await buildPdf(pages, sources);
      if (doc.fileHandle) {
        let perm = await doc.fileHandle.queryPermission?.({ mode: "readwrite" });
        if (perm !== "granted") perm = await doc.fileHandle.requestPermission?.({ mode: "readwrite" });
        if (perm !== "granted") {
          toast.error("Permission to modify the file was denied.");
          return;
        }
        const writable = await doc.fileHandle.createWritable();
        await writable.write(bytes);
        await writable.close();
        toast.success("Changes saved back to the file on your device");
      } else if (supportsFS) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `${doc.name || "document"}.pdf`,
          types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(bytes);
        await writable.close();
        dispatch({ type: "SET_HANDLE", id: doc.id, handle });
        toast.success("Saved to your device");
      } else {
        downloadBytes(bytes, `${doc.name || "document"}.pdf`);
        toast.success("Downloaded edited PDF");
      }
    } catch (e) {
      toast.error("Could not save to device.");
    } finally {
      setLoading(false);
    }
  };

  const closeTutorial = () => {
    localStorage.setItem("pdf_tutorial_done", "1");
    setTut((t) => ({ ...t, open: false }));
  };

  const goPage = (delta) => {
    if (activeIndex < 0) return;
    const ni = Math.max(0, Math.min(pages.length - 1, activeIndex + delta));
    setActivePage(pages[ni].id);
  };

  const hasDoc = !!doc;

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-background text-foreground">
      <TopBar
        isMobile={isMobile}
        user={user}
        logout={logout}
        theme={theme}
        toggleTheme={toggle}
        docName={doc?.name}
        hasDoc={hasDoc}
        saveStatus={saveStatus}
        onOpenFile={openFile}
        onOpenFromDevice={openFromDevice}
        onSaveToDevice={() => (doc?.fileHandle ? setSaveDlg(true) : saveToDevice())}
        supportsFS={supportsFS}
        onMergeFile={mergeFile}
        onSplit={() => setSplitDlg({ open: true, at: Math.max(1, Math.ceil(pages.length / 2)) })}
        onExport={exportFull}
        onExportSelected={exportSelected}
        selectedCount={doc?.selected.size || 0}
        canUndo={(doc?.past.length || 0) > 0}
        canRedo={(doc?.future.length || 0) > 0}
        undo={() => dispatch({ type: "UNDO", id: doc.id })}
        redo={() => dispatch({ type: "REDO", id: doc.id })}
        scale={doc?.scale || 1.4}
        setScale={setScale}
        onRotateActive={() => doc && rotatePage(doc.activePageId)}
        pageIndex={activeIndex < 0 ? 0 : activeIndex}
        pageCount={pages.length}
        onPrev={() => goPage(-1)}
        onNext={() => goPage(1)}
        onHelp={() => setTut({ open: true, step: 0 })}
        viewMode={viewMode}
        setViewMode={setViewMode}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((s) => !s)}
      />

      <Tabs
        docs={docs}
        activeDocId={activeDocId}
        onActivate={(id) => dispatch({ type: "ACTIVATE", id })}
        onClose={(id) => dispatch({ type: "CLOSE", id })}
        onNew={() => dispatch({ type: "ACTIVATE", id: null })}
      />

      <div className="flex-1 w-full flex overflow-hidden relative">
        {hasDoc && sidebarOpen && (
          <>
            {isMobile && (
              <div
                data-testid="sidebar-backdrop"
                className="absolute inset-0 z-30 bg-black/40"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            <Sidebar
              isMobile={isMobile}
              pages={pages}
              sources={sources}
              activePageId={doc.activePageId}
              setActivePage={(id) => {
                setActivePage(id);
                if (isMobile) setSidebarOpen(false);
              }}
              selected={doc.selected}
              toggleSelect={toggleSelect}
              onReorder={reorder}
              onRotate={rotatePage}
              onDelete={deletePage}
              onAddPage={addPage}
              onRequestImage={(index) => setImgDlg({ open: true, index })}
              onCollapse={() => setSidebarOpen(false)}
            />
          </>
        )}

        <main className="flex-1 h-full bg-canvas overflow-hidden relative" data-testid="canvas-area">
          {hasDoc && !sidebarOpen && (
            <button
              data-testid="sidebar-expand-btn"
              onClick={() => setSidebarOpen(true)}
              className="absolute top-3 left-3 z-30 h-9 w-9 rounded-lg bg-card border border-border shadow flex items-center justify-center hover:bg-muted"
              title="Show pages panel"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}

          {!hasDoc ? (
            <StartScreen
              recents={recents}
              onOpenFile={openFile}
              onOpenRecent={openRecent}
              onRemoveRecent={removeRecentFile}
              onOpenDevice={openFromDevice}
              supportsFS={supportsFS}
              loading={loading}
              dragOver={dragOver}
              setDragOver={setDragOver}
            />
          ) : (
            <>
              <Reader
                doc={doc}
                viewMode={viewMode}
                setActivePage={setActivePage}
                setScale={setScale}
                onCommit={commitAnnotations}
                toolState={{ tool, color, size, opacity, straight }}
              />
              <Toolbar
                isMobile={isMobile}
                tool={tool}
                setTool={setTool}
                color={color}
                setColor={setColor}
                size={size}
                setSize={setSize}
                opacity={opacity}
                setOpacity={setOpacity}
                straight={straight}
                setStraight={setStraight}
              />
            </>
          )}
        </main>
      </div>

      <Tutorial
        open={tut.open}
        step={tut.step}
        setStep={(s) => setTut((t) => ({ ...t, step: s }))}
        onClose={closeTutorial}
      />

      <ImageInsertDialog
        open={imgDlg.open}
        onOpenChange={(v) => setImgDlg((d) => ({ ...d, open: v }))}
        onInsert={insertImage}
      />

      <Dialog open={splitDlg.open} onOpenChange={(v) => setSplitDlg((d) => ({ ...d, open: v }))}>
        <DialogContent className="sm:max-w-md" data-testid="split-dialog">
          <DialogHeader>
            <DialogTitle>Split document</DialogTitle>
            <DialogDescription>
              Part 1 gets pages 1–{splitDlg.at}, Part 2 gets the rest. Both download
              as separate PDFs.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-4 py-2">
            <span className="text-sm text-muted-foreground w-28 shrink-0">Split after page</span>
            <Slider
              data-testid="split-slider"
              value={[splitDlg.at]}
              min={1}
              max={Math.max(1, pages.length - 1)}
              step={1}
              onValueChange={(v) => setSplitDlg((d) => ({ ...d, at: v[0] }))}
            />
            <span className="text-sm font-semibold tabular-nums w-8 text-right">{splitDlg.at}</span>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSplitDlg((d) => ({ ...d, open: false }))}>
              Cancel
            </Button>
            <Button onClick={doSplit} data-testid="split-confirm-btn">
              Split &amp; download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveDlg} onOpenChange={setSaveDlg}>
        <DialogContent className="sm:max-w-md" data-testid="save-device-dialog">
          <DialogHeader>
            <DialogTitle>Save changes to your device?</DialogTitle>
            <DialogDescription>
              This will write your edited PDF — annotations, page changes and all —
              back onto the original file on this device. Your browser may ask you to
              grant write permission.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveDlg(false)}>
              Cancel
            </Button>
            <Button onClick={saveToDevice} data-testid="save-device-confirm-btn">
              Grant &amp; save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading && hasDoc && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-card border border-border px-3 py-2 shadow-lg text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Working…
        </div>
      )}
    </div>
  );
}
