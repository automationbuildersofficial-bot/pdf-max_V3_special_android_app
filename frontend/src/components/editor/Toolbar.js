import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { TOOLS, PALETTE, DRAW_TOOLS, TOOL_DEFAULT_OPACITY } from "@/lib/constants";
import { Check, GripVertical } from "lucide-react";

export default function Toolbar({
  tool,
  setTool,
  color,
  setColor,
  size,
  setSize,
  opacity,
  setOpacity,
  straight,
  setStraight,
}) {
  const showStroke = DRAW_TOOLS.includes(tool) || ["line", "arrow", "rect", "ellipse"].includes(tool);
  const showStraight = DRAW_TOOLS.includes(tool);
  const showOpacity = DRAW_TOOLS.includes(tool);

  const [pos, setPos] = useState(() => {
    try {
      const raw = localStorage.getItem("pdf_toolbar_pos");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });
  const drag = useRef(null);
  const barRef = useRef(null);

  const onDragMove = useCallback((e) => {
    if (!drag.current) return;
    const nx = e.clientX - drag.current.dx;
    const ny = e.clientY - drag.current.dy;
    const bw = barRef.current?.offsetWidth || 300;
    const bh = barRef.current?.offsetHeight || 56;
    setPos({
      x: Math.max(8, Math.min(window.innerWidth - bw - 8, nx)),
      y: Math.max(64, Math.min(window.innerHeight - bh - 8, ny)),
    });
  }, []);

  const onDragEnd = useCallback(() => {
    drag.current = null;
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
  }, [onDragMove]);

  useEffect(() => {
    if (pos) localStorage.setItem("pdf_toolbar_pos", JSON.stringify(pos));
    else localStorage.removeItem("pdf_toolbar_pos");
  }, [pos]);

  const onGripDown = (e) => {
    const rect = barRef.current.getBoundingClientRect();
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    if (!pos) setPos({ x: rect.left, y: rect.top });
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd);
  };

  const handleTool = (id) => {
    setTool(id);
    if (TOOL_DEFAULT_OPACITY[id] !== undefined) setOpacity(TOOL_DEFAULT_OPACITY[id]);
  };

  const positioned = pos
    ? { position: "fixed", left: pos.x, top: pos.y }
    : undefined;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={barRef}
        data-testid="annotation-toolbar"
        style={positioned}
        className={`z-40 flex flex-wrap items-center justify-center gap-1 p-1.5 rounded-2xl bg-card/90 backdrop-blur-xl border border-border shadow-2xl max-w-[95vw] ${
          pos ? "" : "absolute bottom-5 left-1/2 -translate-x-1/2"
        }`}
      >
        <button
          data-testid="toolbar-drag-handle"
          onPointerDown={onGripDown}
          onDoubleClick={() => setPos(null)}
          className="h-10 w-6 shrink-0 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground hover:bg-muted"
          title="Drag to move · double-click to reset"
        >
          <GripVertical className="h-5 w-5" />
        </button>
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const active = tool === t.id;
          return (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <button
                  data-testid={`tool-${t.id}-btn`}
                  onClick={() => handleTool(t.id)}
                  className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center transition-colors duration-200 active:scale-95 ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="sr-only">{t.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{t.label}</TooltipContent>
            </Tooltip>
          );
        })}

        <Separator orientation="vertical" className="h-8 mx-1" />

        {/* Color palette */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              data-testid="color-picker-btn"
              className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
            >
              <span
                className="h-6 w-6 rounded-full border-2 border-white shadow ring-1 ring-black/10"
                style={{ backgroundColor: color }}
              />
              <span className="sr-only">Choose colour</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-64">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Colour
            </p>
            <div className="grid grid-cols-5 gap-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  data-testid={`color-${c.replace("#", "")}`}
                  onClick={() => setColor(c)}
                  className="h-9 w-9 rounded-full flex items-center justify-center border border-black/10 transition-transform hover:scale-110"
                  style={{ backgroundColor: c }}
                >
                  {color.toLowerCase() === c.toLowerCase() && (
                    <Check
                      className={`h-4 w-4 ${
                        c === "#FFFFFF" || c === "#EAB308" ? "text-black" : "text-white"
                      }`}
                    />
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {showStroke && (
          <>
            <Separator orientation="vertical" className="h-8 mx-1" />
            <div className="flex items-center gap-2 px-2 min-w-[130px]">
              <span className="text-xs text-muted-foreground w-8 shrink-0">Size</span>
              <Slider
                data-testid="size-slider"
                value={[size]}
                min={1}
                max={40}
                step={1}
                onValueChange={(v) => setSize(v[0])}
                className="w-20"
              />
              <span className="text-xs tabular-nums w-5">{size}</span>
            </div>
          </>
        )}

        {showOpacity && (
          <div className="flex items-center gap-2 px-2 min-w-[130px]">
            <span className="text-xs text-muted-foreground w-8 shrink-0">Flow</span>
            <Slider
              data-testid="opacity-slider"
              value={[Math.round(opacity * 100)]}
              min={10}
              max={100}
              step={5}
              onValueChange={(v) => setOpacity(v[0] / 100)}
              className="w-20"
            />
            <span className="text-xs tabular-nums w-8">{Math.round(opacity * 100)}%</span>
          </div>
        )}

        {showStraight && (
          <>
            <Separator orientation="vertical" className="h-8 mx-1" />
            <div className="flex items-center gap-2 px-2">
              <Switch
                data-testid="straight-toggle"
                checked={straight}
                onCheckedChange={setStraight}
              />
              <span className="text-xs whitespace-nowrap">Straight</span>
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
