# PDF Studio — Product Requirements & Progress

## Original problem statement
A browser-based PDF reader/editor with: edit mode (pen/pencil/highlighter with 10–20 colours,
intensity, straight/auto + freehand modes), eraser, undo/redo, text & audio comments (cancelable),
website links (cancelable), shapes, page reorder, page extraction by selection, insert writing
pages (blank/ruled/etc.) between pages, delete pages, rotate pages, insert image pages (with
crop/edit + controllable resolution), merge & split PDFs, crop pages, a PowerPoint-style page
sidebar, night mode, Google-only accounts, Google Drive edit/sync (with permission), and a
first-time tutorial. Later additions: "Continue as guest" login, device document access with
save-back (File System Access API), tabs for multiple PDFs, on-device recent-files history,
collapsible sidebar, movable annotation toolbar, and multiple reading modes (continuous scroll
default, single page, book/two-page).

## Architecture
- **Frontend**: React (CRACO), Tailwind + shadcn/ui, lucide-react. PDF render via `pdfjs-dist`
  (worker from cdnjs), structural/export via `pdf-lib` (WYSIWYG raster export). Auth via
  `@react-oauth/google` (auth-code flow) + guest mode. On-device storage via IndexedDB + localStorage.
- **Backend**: FastAPI + MongoDB (motor). Google OAuth code exchange + JWT sessions; documents
  metadata CRUD. All routes under `/api`.
- **Key files**: `pages/Workspace.js` (multi-doc reducer/orchestrator), `components/editor/*`
  (TopBar, Sidebar, Reader, PageView, Toolbar, Tabs, StartScreen, Tutorial, ImageInsertDialog),
  `lib/pdfEngine.js`, `lib/exportPdf.js`, `lib/storage.js`, `lib/constants.js`.

## User personas
- Students/professionals annotating and reorganising PDFs entirely in the browser, privately on device.

## Core requirements (static)
- Client-side editing; no document leaves the device unless the user exports/saves.
- Google-only accounts + guest mode.

## Implemented (2026-06)
- **Installable PWA (Android/iOS home-screen app)** — added `public/manifest.json` (name, standalone
  display, theme/bg colours, 192/512 + maskable icons), a network-first `public/service-worker.js`
  (offline app-shell fallback, safe for dev hot-reload), registration via `src/registerSW.js` (HTTPS
  only, skips localhost), PWA meta tags + manifest/apple-touch links in `public/index.html`, and an
  in-app `InstallPrompt` banner (`src/components/InstallPrompt.js`, wired in `App.js`) that uses
  `beforeinstallprompt` on Android and shows an "Add to Home Screen" hint on iOS. App icon generated
  (indigo/violet document + pen glyph). Verified: SW registers, manifest served 200, title/icon updated.
- **Mobile pinch-to-zoom** — user couldn't zoom on mobile web; added two-finger pinch-to-zoom on the
  PDF reader (non-passive touch handlers on the reader container adjust doc scale, clamped 0.4×–4×).
  Overflow-menu zoom buttons (m-zoom-in/out) also confirmed working. Verified 7/7 (iteration_5.json).
- **Landscape auto-refit** — pages recompute fit-to-width on orientation change / resize below 1024px
  (capped 1.6×), so rotating a phone to landscape re-fits automatically.
- **Mobile responsiveness (Android/phones)** — fixed "lacking & glitching on Android": TopBar now
  collapses to a compact page-nav + overflow menu (`mobile-menu-btn`) below 768px; PDF pages auto-fit
  the screen width on open (no forced horizontal scroll); pages sidebar becomes an opaque overlay
  drawer (+ backdrop) that auto-closes on page tap and defaults CLOSED on mobile; annotation canvas
  allows touch-scroll in the default 'select' tool (touch-action toggles per tool); floating toolbar
  wraps instead of hiding tools. Verified 7/7 mobile flows + desktop regression (iteration_4.json).
- Auth: Google OAuth (code flow, reads GOOGLE_CLIENT_ID/SECRET) + **Continue as guest**. JWT + /api/auth/me.
- Reader: continuous-scroll (default), single-page, book/two-page modes; lazy page painting; page rotation.
- Annotations: pen, pencil, highlighter (20 colours, size, opacity/flow, straight vs freehand),
  shapes (line/arrow/rect/ellipse), text comments, website links, object eraser, undo/redo.
- Pages: PowerPoint-style thumbnail sidebar (collapsible), drag-reorder, rotate, delete, select→extract,
  insert blank/ruled/grid/dotted pages, insert image page (crop + rotate + resolution), merge, split.
- Export: download edited PDF (annotations flattened), extract selected pages, split into two files.
- Device: open-from-device + **Save back to the original file** (File System Access API, with a
  permission confirmation), fallback to Save/Download.
- Multi-doc **tabs**; **recent-files** history stored on device (IndexedDB bytes + localStorage list),
  reopen from recents.
- Movable floating toolbar (drag handle, double-click to reset). Night mode. First-time tutorial.
- Testing: backend 17/17 pytest pass; frontend flows verified (drawing verified via canvas pixel diff);
  critical flex-shrink layout bug fixed; toolbar-reset persistence fixed.

## Backlog / remaining
- **P0**: User to supply Google Cloud OAuth Client ID/Secret to enable Google login (guest works now).
- **P1**: Audio comments (deferred in v1); Google Drive browse/open/save-back (deferred in v1).
- **P1**: Persist annotations/edits per file across full reloads (currently recents reopen the original bytes).
- **P2**: Page crop UI; image-insert dialog broader editing; vector (selectable-text) export option;
  surface render errors instead of silent catch; split Workspace.js into hooks.

## Next tasks
- Collect Google OAuth credentials from user and set backend/.env + frontend/.env; re-verify login.
- Optionally implement Drive sync and audio comments in follow-ups.
