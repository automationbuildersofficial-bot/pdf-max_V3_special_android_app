import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  PenTool,
  Layers,
  RotateCw,
  ImagePlus,
  Combine,
  MousePointer2,
} from "lucide-react";

const STEPS = [
  {
    icon: MousePointer2,
    title: "Welcome to PDF Studio",
    body: "A full PDF workspace in your browser. Open a PDF and start reading, annotating and reshaping it. Here is a 60-second tour.",
  },
  {
    icon: PenTool,
    title: "Annotate anything",
    body: "Use the floating toolbar at the bottom: pens, pencils and a highlighter with 20 colours, adjustable thickness & intensity. Toggle 'Straight' for perfect straight lines, or draw freehand. Add shapes, text comments and clickable website links. The eraser removes any mark.",
  },
  {
    icon: Layers,
    title: "Pages panel",
    body: "The left panel works like slides. Drag thumbnails to reorder, tick pages to extract them into a new PDF, and use the + between pages to insert blank, ruled, grid or dotted pages, or an image.",
  },
  {
    icon: RotateCw,
    title: "Rotate, crop & delete",
    body: "Rotate the current page from the top bar or a thumbnail's menu. Delete pages you don't need. Undo / redo keeps every change reversible.",
  },
  {
    icon: Combine,
    title: "Merge, split & export",
    body: "Append another PDF (merge), split the document at any page, then export your edited file — annotations included.",
  },
];

export default function Tutorial({ open, onClose, step, setStep }) {
  const s = STEPS[step];
  const Icon = s.icon;
  const last = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="tutorial-dialog">
        <DialogHeader>
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <DialogTitle className="text-xl">{s.title}</DialogTitle>
          <DialogDescription className="leading-relaxed text-sm pt-1">
            {s.body}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center gap-1.5 py-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            data-testid="tutorial-skip-btn"
          >
            Skip
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                data-testid="tutorial-back-btn"
              >
                Back
              </Button>
            )}
            <Button
              onClick={() => (last ? onClose() : setStep(step + 1))}
              data-testid="tutorial-next-btn"
            >
              {last ? "Start editing" : "Next"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
