import React, { useRef, useState, useEffect, useCallback } from "react";
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
import { RotateCw, Crop, Upload, ImagePlus } from "lucide-react";
import { loadImage } from "@/lib/pdfEngine";

const BOX = 380;

export default function ImageInsertDialog({ open, onOpenChange, onInsert }) {
  const fileRef = useRef(null);
  const [img, setImg] = useState(null); // HTMLImageElement (working, rotation baked)
  const [crop, setCrop] = useState(null); // {x,y,w,h} in natural coords
  const [maxWidth, setMaxWidth] = useState(1200);
  const [drag, setDrag] = useState(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setImg(null);
      setCrop(null);
      setMaxWidth(1200);
      setDrag(null);
    }
  }, [open]);

  const fit = img ? Math.min(BOX / img.width, BOX / img.height) : 1;
  const dispW = img ? img.width * fit : 0;
  const dispH = img ? img.height * fit : 0;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(file);
    });
    const image = await loadImage(url);
    setImg(image);
    setCrop({ x: 0, y: 0, w: image.width, h: image.height });
  };

  const rotate = async () => {
    if (!img) return;
    const c = document.createElement("canvas");
    c.width = img.height;
    c.height = img.width;
    const ctx = c.getContext("2d");
    ctx.translate(c.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, 0, 0);
    const rotated = await loadImage(c.toDataURL("image/png"));
    setImg(rotated);
    setCrop({ x: 0, y: 0, w: rotated.width, h: rotated.height });
  };

  const toNatural = (clientX, clientY) => {
    const rect = overlayRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / fit;
    const y = (clientY - rect.top) / fit;
    return {
      x: Math.max(0, Math.min(img.width, x)),
      y: Math.max(0, Math.min(img.height, y)),
    };
  };

  const onDown = (e) => {
    if (!img) return;
    const p = toNatural(e.clientX, e.clientY);
    setDrag({ sx: p.x, sy: p.y });
  };
  const onMove = (e) => {
    if (!drag) return;
    const p = toNatural(e.clientX, e.clientY);
    setCrop({
      x: Math.min(drag.sx, p.x),
      y: Math.min(drag.sy, p.y),
      w: Math.abs(p.x - drag.sx),
      h: Math.abs(p.y - drag.sy),
    });
  };
  const onUp = () => {
    if (drag && crop && crop.w < 8) setCrop({ x: 0, y: 0, w: img.width, h: img.height });
    setDrag(null);
  };

  const insert = () => {
    if (!img || !crop) return;
    const cw = crop.w || img.width;
    const ch = crop.h || img.height;
    const scale = Math.min(1, maxWidth / cw);
    const outW = Math.round(cw * scale);
    const outH = Math.round(ch * scale);
    const c = document.createElement("canvas");
    c.width = outW;
    c.height = outH;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(img, crop.x, crop.y, cw, ch, 0, 0, outW, outH);
    onInsert(c.toDataURL("image/jpeg", 0.92), outW, outH);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="image-insert-dialog">
        <DialogHeader>
          <DialogTitle>Insert image as a new page</DialogTitle>
          <DialogDescription>
            Crop the image by dragging a box over it, rotate if needed and choose
            the output resolution. It will be added as its own page.
          </DialogDescription>
        </DialogHeader>

        {!img ? (
          <button
            data-testid="image-upload-zone"
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 h-52 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-muted/50 transition-colors"
          >
            <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm text-muted-foreground">
              Click to choose an image
            </span>
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div
                ref={overlayRef}
                onMouseDown={onDown}
                onMouseMove={onMove}
                onMouseUp={onUp}
                onMouseLeave={onUp}
                className="relative cursor-crosshair select-none rounded-lg overflow-hidden border border-border"
                style={{ width: dispW, height: dispH }}
              >
                <img
                  src={img.src}
                  alt="preview"
                  draggable={false}
                  style={{ width: dispW, height: dispH }}
                />
                {crop && (
                  <div
                    className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
                    style={{
                      left: crop.x * fit,
                      top: crop.y * fit,
                      width: crop.w * fit,
                      height: crop.h * fit,
                    }}
                  />
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={rotate} data-testid="image-rotate-btn">
                <RotateCw className="h-4 w-4 mr-1.5" /> Rotate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCrop({ x: 0, y: 0, w: img.width, h: img.height })}
                data-testid="image-reset-crop-btn"
              >
                <Crop className="h-4 w-4 mr-1.5" /> Reset crop
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileRef.current?.click()}
                className="ml-auto"
              >
                Change image
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-24 shrink-0">
                Max width
              </span>
              <Slider
                data-testid="image-resolution-slider"
                value={[maxWidth]}
                min={200}
                max={2400}
                step={100}
                onValueChange={(v) => setMaxWidth(v[0])}
              />
              <span className="text-xs tabular-nums w-16 text-right">{maxWidth}px</span>
            </div>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
          data-testid="image-file-input"
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={insert} disabled={!img} data-testid="image-insert-confirm-btn">
            <ImagePlus className="h-4 w-4 mr-1.5" /> Insert page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
