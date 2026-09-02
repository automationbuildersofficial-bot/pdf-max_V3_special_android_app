import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  FolderOpen,
  HardDrive,
  Save,
  Combine,
  Scissors,
  Download,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Sun,
  Moon,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  ScrollText,
  BookOpen,
  Loader2,
  Check,
  Square as SquareIcon,
} from "lucide-react";

const VIEW_MODES = [
  { id: "scroll", label: "Continuous scroll", icon: ScrollText },
  { id: "single", label: "Single page", icon: SquareIcon },
  { id: "book", label: "Book (two-page)", icon: BookOpen },
];

function IconBtn({ label, onClick, disabled, children, testid }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          disabled={disabled}
          data-testid={testid}
          className="h-9 w-9 rounded-lg"
        >
          {children}
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export default function TopBar(props) {
  const {
    user,
    logout,
    theme,
    toggleTheme,
    docName,
    hasDoc,
    saveStatus,
    onOpenFile,
    onOpenFromDevice,
    onSaveToDevice,
    supportsFS,
    onMergeFile,
    onSplit,
    onExport,
    onExportSelected,
    selectedCount,
    canUndo,
    canRedo,
    undo,
    redo,
    scale,
    setScale,
    onRotateActive,
    pageIndex,
    pageCount,
    onPrev,
    onNext,
    onHelp,
    viewMode,
    setViewMode,
    sidebarOpen,
    onToggleSidebar,
  } = props;
  const openRef = useRef(null);
  const mergeRef = useRef(null);

  return (
    <TooltipProvider delayDuration={200}>
      <header
        data-testid="top-bar"
        className="h-14 w-full flex items-center justify-between px-3 sm:px-4 bg-card border-b border-border z-30 shrink-0 gap-2"
      >
        {/* Left */}
        <div className="flex items-center gap-2 min-w-0">
          {hasDoc && (
            <IconBtn
              label={sidebarOpen ? "Hide pages" : "Show pages"}
              onClick={onToggleSidebar}
              testid="toggle-sidebar-btn"
            >
              <PanelLeft className="h-4 w-4" />
            </IconBtn>
          )}
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
          </div>
          <div className="min-w-0 hidden sm:block">
            <p className="text-sm font-semibold leading-tight truncate max-w-[160px]">
              {docName || "PDF Studio"}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {hasDoc ? `${pageCount} pages` : "No document"}
            </p>
          </div>
          {hasDoc && saveStatus !== "idle" && (
            <div
              data-testid="autosave-indicator"
              className="hidden md:flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground"
            >
              {saveStatus === "saving" ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  All changes saved
                </>
              )}
            </div>
          )}
        </div>

        {/* Center */}
        {hasDoc && (
          <div className="flex items-center gap-1">
            <IconBtn label="Undo" onClick={undo} disabled={!canUndo} testid="undo-btn">
              <Undo2 className="h-4 w-4" />
            </IconBtn>
            <IconBtn label="Redo" onClick={redo} disabled={!canRedo} testid="redo-btn">
              <Redo2 className="h-4 w-4" />
            </IconBtn>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <IconBtn label="Previous page" onClick={onPrev} testid="prev-page-btn">
              <ChevronLeft className="h-4 w-4" />
            </IconBtn>
            <span className="text-xs tabular-nums w-14 text-center">
              {pageIndex + 1} / {pageCount}
            </span>
            <IconBtn label="Next page" onClick={onNext} testid="next-page-btn">
              <ChevronRight className="h-4 w-4" />
            </IconBtn>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <IconBtn
              label="Zoom out"
              onClick={() => setScale(Math.max(0.4, scale - 0.2))}
              testid="zoom-out-btn"
            >
              <ZoomOut className="h-4 w-4" />
            </IconBtn>
            <span className="text-xs tabular-nums w-10 text-center">
              {Math.round((scale / 1.4) * 100)}%
            </span>
            <IconBtn
              label="Zoom in"
              onClick={() => setScale(Math.min(4, scale + 0.2))}
              testid="zoom-in-btn"
            >
              <ZoomIn className="h-4 w-4" />
            </IconBtn>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <IconBtn label="Rotate page 90°" onClick={onRotateActive} testid="rotate-active-btn">
              <RotateCw className="h-4 w-4" />
            </IconBtn>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 rounded-lg gap-1.5" data-testid="view-mode-btn">
                  {(() => {
                    const vm = VIEW_MODES.find((v) => v.id === viewMode) || VIEW_MODES[0];
                    const I = vm.icon;
                    return <I className="h-4 w-4" />;
                  })()}
                  <span className="hidden md:inline text-xs">
                    {(VIEW_MODES.find((v) => v.id === viewMode) || VIEW_MODES[0]).label}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuLabel>Reading mode</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {VIEW_MODES.map((v) => {
                  const I = v.icon;
                  return (
                    <DropdownMenuItem
                      key={v.id}
                      onClick={() => setViewMode(v.id)}
                      data-testid={`view-mode-${v.id}`}
                    >
                      <I className="h-4 w-4 mr-2" /> {v.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Right */}
        <div className="flex items-center gap-1">
          {hasDoc && (
            <>
              <IconBtn
                label="Merge another PDF"
                onClick={() => mergeRef.current?.click()}
                testid="merge-btn"
              >
                <Combine className="h-4 w-4" />
              </IconBtn>
              <IconBtn label="Split document" onClick={onSplit} testid="split-btn">
                <Scissors className="h-4 w-4" />
              </IconBtn>
              <IconBtn
                label="Save to device"
                onClick={onSaveToDevice}
                testid="save-device-btn"
              >
                <Save className="h-4 w-4" />
              </IconBtn>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-9 rounded-lg gap-1.5 ml-1" data-testid="export-btn">
                    <Download className="h-4 w-4" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onExport} data-testid="export-full-btn">
                    <Download className="h-4 w-4 mr-2" /> Download edited PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onExportSelected}
                    disabled={selectedCount === 0}
                    data-testid="export-selected-btn"
                  >
                    <Scissors className="h-4 w-4 mr-2" /> Extract selected ({selectedCount})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          <IconBtn
            label="Open a PDF"
            onClick={() => openRef.current?.click()}
            testid="open-file-btn"
          >
            <FolderOpen className="h-4 w-4" />
          </IconBtn>
          {supportsFS && (
            <IconBtn
              label="Open from device (save-back)"
              onClick={onOpenFromDevice}
              testid="open-device-btn"
            >
              <HardDrive className="h-4 w-4" />
            </IconBtn>
          )}
          <IconBtn
            label={theme === "dark" ? "Light mode" : "Night mode"}
            onClick={toggleTheme}
            testid="theme-toggle-btn"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </IconBtn>
          <IconBtn label="Tutorial" onClick={onHelp} testid="help-btn">
            <HelpCircle className="h-4 w-4" />
          </IconBtn>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-1" data-testid="user-menu-btn">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.picture} alt={user?.name} />
                  <AvatarFallback>{(user?.name || "U")[0]}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">
                <p className="font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground font-normal truncate">
                  {user?.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} data-testid="logout-btn">
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <input
          ref={openRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          data-testid="open-file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onOpenFile(f);
            e.target.value = "";
          }}
        />
        <input
          ref={mergeRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          data-testid="merge-file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onMergeFile(f);
            e.target.value = "";
          }}
        />
      </header>
    </TooltipProvider>
  );
}
