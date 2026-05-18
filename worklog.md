# ShowFlow Worklog - 2026-05-18

## Changes Made

### Task 1: Fix Projection (Chiếu) Button - CRITICAL ✅
**File:** `src/components/presentation/scene-list.tsx`

- Replaced `openOutputWindow` function:
  - Added try/catch around Presentation API to gracefully fallback
  - Added success toast when Presentation API connects
- Replaced `fallbackOpenWindow` function:
  - Added second monitor detection using `window.screenLeft + window.screen.width`
  - Opens window at `left=${secondMonitorX}` to auto-position on second monitor
  - Added popup-blocked detection with clear Vietnamese error toast (6s duration) with instructions
  - Calls `stopLive()` if popup is blocked to clean up state
  - Added guidance toast (5s) telling user to drag window to monitor 2 and press F11
- Updated `handleStartProjection`:
  - Added empty scenes check with error toast
  - Removed redundant `toast.success('Đã bắt đầu chiếu cục bộ')` since `openOutputWindow` now shows its own toast

### Task 2: Fix Preview Panel - Screen Layout + 16:9 Fill ✅
**File:** `src/components/presentation/preview-panel.tsx`

- Rewrote entire PreviewPanel component
- Screen 2 (Tiếp theo) remains LEFT, Screen 1 (Đang chiếu) remains RIGHT (correct per user request)
- Fixed 16:9 aspect ratio: Changed from `max-w-full max-h-full` with `aspectRatio` to `w-full h-full` with `maxHeight: '100%', maxWidth: '100%'` on the container div
- Added `flex items-center justify-center` to both preview containers for proper centering
- Updated `handleGoLive` with improved second monitor detection and better toast messages

### Task 3: Add CloudConvert API Integration for PPTX ✅
**File:** `src/app/api/convert-pptx/route.ts`

- Completely rewrote the route with two conversion backends:
  1. **LibreOffice** (preferred) - cached availability check, same conversion flow
  2. **CloudConvert API** (fallback) - uses `cloudconvert` npm package
     - Creates job with upload → convert to PNG → export URL pipeline
     - Downloads result images and converts to base64 data URLs
     - Requires `CLOUDCONVERT_API_KEY` environment variable
- Returns clear error messages when neither LibreOffice nor CloudConvert is available

### Task 4: Add CloudConvert API Key Setting to ControlPanel ✅
**File:** `src/components/presentation/scene-list.tsx` (ControlPanel component)

- Added state: `cloudConvertKey` (initialized from localStorage), `showApiKeyInput`
- Added collapsible "PPTX Cloud" section at bottom of ControlPanel
- Section shows Settings icon + "PPTX Cloud" label
- When expanded: shows explanation text and password input for API key
- Key is saved to `localStorage` on every change

**New file:** `src/app/api/convert-pptx/cloud-key/route.ts`
- GET endpoint that checks if CloudConvert API key is available (from header or env)

### Task 5: Fix PPTX Parser to Pass CloudConvert Key ✅
**File:** `src/lib/pptx-parser.ts`

- Updated `convertPptxServer` function to pass `x-cloudconvert-key` header
- Reads key from `localStorage.getItem('showflow-cloudconvert-key')` on client side
- Passes as custom header in the fetch request to the convert API

### Task 7: Fix Click on Scene Box to Expand Detail Panel ✅
**File:** `src/components/presentation/scene-list.tsx`

- Changed detail panel `max-h-[50%]` to `max-h-[60%]` for more visible space
- Added `animate-in slide-in-from-bottom-2 duration-200` animation class for smooth appearance

### Task 8: Rearrange Control Panel Buttons ✅
**File:** `src/components/presentation/scene-list.tsx` (ControlPanel component)

- Reorganized from 4 rows to 6 clearly separated sections:
  1. **Chiếu** - Chiếu | Dừng | Đen
  2. **Điều hướng** - Trước | counter | Tiếp
  3. **Hiệu ứng** - Transition select + Duration slider (grouped together)
  4. **Âm thanh** - Volume slider + Mute button (own section)
  5. **Kích thước** - Screen size preset + custom size
  6. **Video** - (conditional) Pause + Trim controls
  7. **Dự án** - Online | Lưu | Mở
- Added `<div className="h-px bg-zinc-800" />` dividers between sections
- Changed section labels from generic "Cài đặt" to specific names

### Additional
- Installed `cloudconvert` npm package

---
Task ID: projection-fix-v2
Agent: Main Agent
Task: Fix projection not working - replace postMessage with BroadcastChannel

Work Log:
- Analyzed the root cause: window.open() popup gets blocked by browsers, and postMessage requires a valid window reference
- Created new BroadcastChannel sync module at /src/lib/broadcast-sync.ts
- Updated OutputSync in media-renderer.tsx to use BroadcastChannel as primary sync method (MODE 1)
- Updated output page (/output/page.tsx) to listen on BroadcastChannel as primary connection mode
- Simplified projection button: removed complex Presentation API / fallback logic, just try window.open() directly
- Added "Projection Guide" panel in ControlPanel that shows when popup is blocked
- Guide panel includes clickable link to /output (opens in new tab), copy URL button, and step-by-step instructions
- Guide panel auto-shows when isLive=true but no outputWindowRef (meaning output window not open)
- Updated PreviewPanel Go Live button with same simplified approach
- Fixed 16:9 display in preview panels using absolute positioning with object-fit:contain

Stage Summary:
- BroadcastChannel is the key fix - it works across tabs/windows with same origin, doesn't need window reference
- Even if popup is blocked, user can manually open /output and it will sync automatically
- Guide panel provides clear 3-step instructions in Vietnamese
- Output page now shows connection status indicator always (not just in remote mode)
