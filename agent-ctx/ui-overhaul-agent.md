# Task: ShowFlow UI Overhaul

## Summary
Completed comprehensive UI overhaul for the ShowFlow presentation app with 7 major features implemented across 6 files.

## Changes Made

### 1. Per-slide transitions
- **media-renderer.tsx**: `TransitionRenderer` now uses `scene.sceneTransitionType` and `scene.sceneTransitionDuration` to override global transitions
- **media-renderer.tsx**: `OutputSync` sends per-slide transition in the payload (`currentScene.sceneTransitionType || transitionType`)
- **output/page.tsx**: Uses transition from payload (already resolved per-slide)
- **scene-list.tsx**: `ControlPanel` has a checkbox "Hiệu ứng riêng cho slide này" with per-scene transition type/duration selector

### 2. Scene list: PPTX slides grouped by filename
- **scene-list.tsx**: New `PptxGroupItem` component shows collapsible groups by `pptxFileId`
- Groups show filename from `pptxFileName`, slide count, expand/collapse toggle
- When collapsed: just the filename box. When expanded: individual slides below
- Delete group removes all slides in the group
- **add-scene-dialog.tsx**: Now sets `pptxFileName: file.name` when creating PPTX scenes
- Drag & drop and quick upload also set `pptxFileName`

### 3. Preview panel: balanced screens, bigger buttons, web iframe interactive
- **preview-panel.tsx**: Both preview screens are now `flex-1` (equal size)
- Added CENTER COLUMN with navigation buttons (h-9 w-9):
  - Prev/Next buttons
  - Slide counter
  - Black screen toggle
  - Live/Stop toggle
- **media-renderer.tsx**: For `web` type scenes in preview, renders an interactive `<iframe>` with `sandbox="allow-scripts allow-same-origin allow-popups allow-forms"`

### 4. Video pause/play button in ControlPanel
- **scene-list.tsx**: Added play/pause toggle button in ControlPanel when video scene is active and live
- **media-renderer.tsx**: Exported `setVideoPaused()` function that sends `VIDEO_PAUSE`/`VIDEO_PLAY` postMessage to output window and API
- **output/page.tsx**: Handles `VIDEO_PAUSE`/`VIDEO_PLAY` messages to pause/resume all videos

### 5. Output screen: aspect ratio selection
- **output/page.tsx**: Added subtle aspect ratio buttons (16:9, 4:3) at top-left corner that appear on hover
- Content area adjusts aspect ratio within the fullscreen output
- Buttons use `group-hover:opacity-70` for subtle appearance

### 6. Professional text overlay templates
- **scene-list.tsx**: `TextOverlayPanel` now has a row of preset buttons:
  - "Thanh dưới" (Lower third): fontSize 36, position bottom
  - "Chạy chữ" (Scrolling text): fontSize 40, position bottom
  - "Tiêu đề giữa" (Center title): fontSize 64, position center
  - "Thông báo góc" (Corner notification): fontSize 24, position top
- Clicking a template auto-fills the overlay form with preset values
- Expanded form with fontSize, position, font color, bg color fields

### 7. PPTX parser fix
- Reviewed `pptx-parser.ts`: The relsMap is local to each `parsePptx` call, so keys don't collide between files. No changes needed.
- Added `pptxFileName` to scene creation in both `add-scene-dialog.tsx` and `scene-list.tsx` (drag & drop, quick upload)

## Files Updated
1. `src/components/presentation/add-scene-dialog.tsx` - Added pptxFileName
2. `src/components/presentation/media-renderer.tsx` - Per-slide transitions, video pause, web iframe
3. `src/components/presentation/preview-panel.tsx` - Balanced screens, center controls, web interactive
4. `src/components/presentation/scene-list.tsx` - PPTX grouping, per-scene transition, video pause, overlay templates
5. `src/app/output/page.tsx` - Per-slide transitions, aspect ratio, video pause handling
6. `src/store/presentation-store.ts` - Already had new Scene fields (no changes needed)
7. `src/lib/pptx-parser.ts` - Reviewed, no changes needed

## Lint Status
0 errors, 4 warnings (false positives from Lucide `Image` icon component)
