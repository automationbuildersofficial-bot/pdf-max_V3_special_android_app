import React from "react";
import { X, FileText, Plus } from "lucide-react";

export default function Tabs({ docs, activeDocId, onActivate, onClose, onNew }) {
  if (!docs.length) return null;
  return (
    <div
      data-testid="doc-tabs"
      className="h-10 flex items-stretch gap-1 px-2 bg-muted/40 border-b border-border overflow-x-auto shrink-0"
    >
      {docs.map((d) => {
        const active = d.id === activeDocId;
        return (
          <div
            key={d.id}
            data-testid={`tab-${d.id}`}
            onClick={() => onActivate(d.id)}
            className={`group flex items-center gap-2 pl-3 pr-2 my-1 rounded-lg cursor-pointer max-w-[220px] transition-colors ${
              active
                ? "bg-card shadow-sm border border-border"
                : "hover:bg-card/60 text-muted-foreground"
            }`}
          >
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs font-medium truncate">{d.name || "Untitled"}</span>
            <button
              data-testid={`tab-close-${d.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(d.id);
              }}
              className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted opacity-60 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
      <button
        data-testid="tab-new-btn"
        onClick={onNew}
        className="my-1 px-2 rounded-lg text-muted-foreground hover:bg-card/60 flex items-center"
        title="Open another PDF"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
