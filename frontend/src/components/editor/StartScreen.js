import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { FileUp, HardDrive, Loader2, FileText, X, Clock } from "lucide-react";

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function StartScreen({
  recents,
  onOpenFile,
  onOpenRecent,
  onRemoveRecent,
  onOpenDevice,
  supportsFS,
  loading,
  dragOver,
  setDragOver,
}) {
  const inputRef = useRef(null);

  return (
    <div className="h-full w-full overflow-y-auto canvas-scroll flex flex-col items-center py-10 px-6">
      <div className="w-full max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">Your PDF workspace</h1>
        <p className="text-muted-foreground mb-8">
          Open a PDF to read, annotate and reshape it. Everything stays on this device.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f && f.type === "application/pdf") onOpenFile(f);
          }}
          className={`flex flex-col items-center justify-center gap-4 w-full h-64 rounded-2xl border-2 border-dashed transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border bg-card/40"
          }`}
        >
          <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            {loading ? <Loader2 className="h-7 w-7 animate-spin" /> : <FileUp className="h-7 w-7" />}
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">Drag &amp; drop a PDF here</p>
            <p className="text-sm text-muted-foreground mt-1">or use the buttons below</p>
          </div>
          <div className="flex gap-2">
            <Button data-testid="start-open-btn" onClick={() => inputRef.current?.click()}>
              <FileUp className="h-4 w-4 mr-1.5" /> Browse files
            </Button>
            {supportsFS && (
              <Button
                variant="outline"
                data-testid="start-open-device-btn"
                onClick={onOpenDevice}
              >
                <HardDrive className="h-4 w-4 mr-1.5" /> Open from device
              </Button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            data-testid="start-file-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onOpenFile(f);
              e.target.value = "";
            }}
          />
        </div>

        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Recent files
            </h3>
          </div>
          {recents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Files you open will appear here for quick access.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="recent-list">
              {recents.map((r) => (
                <div
                  key={r.id}
                  data-testid={`recent-${r.id}`}
                  onClick={() => onOpenRecent(r)}
                  className="group flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary hover:shadow-md cursor-pointer transition-all"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.pages ? `${r.pages} pages · ` : ""}
                      {timeAgo(r.ts)}
                    </p>
                  </div>
                  <button
                    data-testid={`recent-remove-${r.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveRecent(r.id);
                    }}
                    className="h-7 w-7 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
