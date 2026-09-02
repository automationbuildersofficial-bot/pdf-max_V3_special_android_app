import React, { useRef, useEffect, useState } from "react";
import { renderComposite } from "@/lib/pdfEngine";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  RotateCw,
  Trash2,
  MoreVertical,
  FileText,
  Image as ImageIcon,
  GripVertical,
  PanelLeftClose,
} from "lucide-react";

function Thumb({ page, sources }) {
  const ref = useRef(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ref.current) return;
      try {
        const scale = 150 / page.width;
        await renderComposite(ref.current, page, sources, Math.min(scale, 0.5));
      } catch (e) {}
    })();
    return () => {
      cancelled = true;
    };
  }, [page, sources]);
  return <canvas ref={ref} className="w-full h-auto block rounded-sm" />;
}

function AddPageMenu({ onAdd, onImage, testid }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid={testid}
          className="group w-full flex items-center justify-center py-1 opacity-40 hover:opacity-100 transition-opacity"
        >
          <span className="flex-1 h-px bg-primary" />
          <span className="mx-2 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <Plus className="h-4 w-4" />
          </span>
          <span className="flex-1 h-px bg-primary" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuLabel>Insert a page here</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onAdd("blank", "blank")}>
          <FileText className="h-4 w-4 mr-2" /> Blank page
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd("blank", "ruled")}>
          <FileText className="h-4 w-4 mr-2" /> Ruled (lined)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd("blank", "grid")}>
          <FileText className="h-4 w-4 mr-2" /> Grid
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd("blank", "dotted")}>
          <FileText className="h-4 w-4 mr-2" /> Dotted
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onImage}>
          <ImageIcon className="h-4 w-4 mr-2" /> Image page…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Sidebar({
  isMobile,
  pages,
  sources,
  activePageId,
  setActivePage,
  selected,
  toggleSelect,
  onReorder,
  onRotate,
  onDelete,
  onAddPage,
  onRequestImage,
  onCollapse,
}) {
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  return (
    <aside
      data-testid="pages-sidebar"
      className={`${
        isMobile
          ? "absolute inset-y-0 left-0 z-40 w-64 max-w-[80vw] shadow-2xl bg-card"
          : "w-60 lg:w-72 bg-muted/20"
      } border-r border-border flex flex-col shrink-0`}
    >
      <div className="h-12 px-4 flex items-center justify-between border-b border-border shrink-0">
        <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Pages · {pages.length}
        </h4>
        <button
          data-testid="sidebar-collapse-btn"
          onClick={onCollapse}
          className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground"
          title="Hide pages panel"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto thumb-scroll px-3 py-2">
        <AddPageMenu
          testid="add-page-top"
          onAdd={(kind, style) => onAddPage(0, kind, style)}
          onImage={() => onRequestImage(0)}
        />
        {pages.map((page, i) => {
          const active = page.id === activePageId;
          const isOver = overIndex === i && dragIndex !== null && dragIndex !== i;
          return (
            <React.Fragment key={page.id}>
              <div
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverIndex(i);
                }}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== i) onReorder(dragIndex, i);
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                data-testid={`thumb-${i}`}
                onClick={() => setActivePage(page.id)}
                className={`group relative rounded-lg p-2 my-1 cursor-pointer transition-colors ${
                  active ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-muted"
                } ${isOver ? "border-t-2 border-primary" : ""}`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Checkbox
                    checked={selected.has(page.id)}
                    onCheckedChange={() => toggleSelect(page.id)}
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`thumb-select-${i}`}
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    {i + 1}
                  </span>
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 ml-auto" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`thumb-menu-${i}`}
                        className="h-6 w-6 rounded flex items-center justify-center hover:bg-background"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => onRotate(page.id)}>
                        <RotateCw className="h-4 w-4 mr-2" /> Rotate 90°
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDelete(page.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete page
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="rounded-sm overflow-hidden shadow-md bg-white">
                  <Thumb page={page} sources={sources} />
                </div>
              </div>
              <AddPageMenu
                testid={`add-page-${i}`}
                onAdd={(kind, style) => onAddPage(i + 1, kind, style)}
                onImage={() => onRequestImage(i + 1)}
              />
            </React.Fragment>
          );
        })}
      </div>
    </aside>
  );
}
