import {
  MousePointer2,
  PenTool,
  Pencil,
  Highlighter,
  Eraser,
  Minus,
  MoveUpRight,
  Square,
  Circle,
  Type,
  Link as LinkIcon,
} from "lucide-react";

export const TOOLS = [
  { id: "select", label: "Select / Move", icon: MousePointer2 },
  { id: "pen", label: "Pen", icon: PenTool },
  { id: "pencil", label: "Pencil", icon: Pencil },
  { id: "highlighter", label: "Highlighter", icon: Highlighter },
  { id: "eraser", label: "Eraser", icon: Eraser },
  { id: "line", label: "Line", icon: Minus },
  { id: "arrow", label: "Arrow", icon: MoveUpRight },
  { id: "rect", label: "Rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse", icon: Circle },
  { id: "text", label: "Text comment", icon: Type },
  { id: "link", label: "Website link", icon: LinkIcon },
];

export const SHAPE_TOOLS = ["line", "arrow", "rect", "ellipse"];
export const DRAW_TOOLS = ["pen", "pencil", "highlighter"];

export const PALETTE = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16",
  "#22C55E", "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9",
  "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#D946EF",
  "#EC4899", "#F43F5E", "#000000", "#525252", "#FFFFFF",
];

export const TOOL_DEFAULT_OPACITY = {
  pen: 1,
  pencil: 0.85,
  highlighter: 0.35,
};
