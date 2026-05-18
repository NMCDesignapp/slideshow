# Task 1 - Fix ShowFlow UI Issues

## Agent: full-stack-developer

## Changes Made

### 1. preview-panel.tsx - Complete rewrite
- **Swapped screens**: Screen 2 (Tiếp theo) now on LEFT, Screen 1 (Đang chiếu) on RIGHT
- **Fixed projection button**: Added `handleGoLive()` that opens output window on second monitor with popup at `screen.width` offset, sets `outputWindowRef`, calls `goLive()`, with toast success/error messages
- **Added toast import**: `import { toast } from 'sonner'`
- **Fixed 16:9 display**: Changed aspect-ratio containers from `w-full` with fixed aspectRatio to `max-w-full max-h-full` with dynamic aspectRatio based on screenSize

### 2. scene-list.tsx - Multiple fixes
- **Reduced scene box height by ~50%**: 
  - `py-0.5` → `py-px`
  - `w-8 h-5` → `w-6 h-4` (mini thumbnail)
  - `text-[8px]` → `text-[7px]` (name text)
  - `min-w-[12px]` → `min-w-[10px]` (order badge)
- **Fixed click-to-expand toggle**: Clicking the same item again now deselects it (sets selectedItemId to null), both for regular scenes and PPTX groups
- **Fixed detail panel layout**: Added `overflow-y-auto max-h-[50%]` to the detail panel container
- **Rearranged ControlPanel** into 4 organized rows with section labels:
  - Row 1 (Chiếu): Chiếu, Dừng, Màn hình đen
  - Row 2 (Điều hướng): ← Trước, slide counter, Tiếp →
  - Row 3 (Cài đặt): Transition select, Duration slider, Volume, Screen size
  - Row 4 (Dự án): Online, Lưu, Mở

## Build Status
- Build passes successfully with no errors
- Lint passes with only pre-existing warnings (jsx-a11y/alt-text)
