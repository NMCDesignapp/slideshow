# ShowFlow Bug Fix Worklog

## Date: 2026-03-05

### FIX 1: Projection ("Chieu") button doesn't work

**Problem:** `window.open()` with position parameters (`left=screenWidth`) is often blocked by popup blockers and cannot reliably position windows on a second monitor.

**Solution:** Redesigned the projection flow in two files:

**`scene-list.tsx` - `handleStartProjection` function:**
- Removed window positioning parameters (`width=1920,height=1080,left=...`) from `window.open()` call - simpler call is more likely to succeed
- Added try/catch around `window.open()` with user-friendly fallback messages
- Sends `REQUEST_FULLSCREEN` via BroadcastChannel after 1.5s delay so the output window can auto-request fullscreen
- Always shows the projection guide panel when `isLive` is true (not just when popup is blocked)
- Projection guide now features a prominent `<a href="/output" target="_blank">` link that bypasses popup blockers
- Guide has collapsible details with step-by-step instructions
- Added "Copy URL" button for manual access

**`preview-panel.tsx` - `handleGoLive` function:**
- Same changes: removed positioning params, added try/catch, BroadcastChannel fullscreen request, better error messages

### FIX 2: 16:9 display not filling preview containers

**Problem:** Preview containers used `width: 100%` + `height: 100%` + `aspectRatio` simultaneously. When both width and height are 100%, the aspectRatio property is ignored by the browser, causing the content to not fill properly.

**Solution:** Changed both "Tiep theo" (left) and "Dang chieu" (right) preview containers:
- Replaced `width: 100%, height: 100%, aspectRatio, objectFit: contain` approach
- Used `absolute inset-0 flex items-center justify-center p-1` wrapper
- Inner div now uses `aspectRatio` with `maxWidth: 100%, maxHeight: 100%, width: 100%` - this lets the aspect ratio dictate the height while constraining to the container
- Added `bg-black rounded` class to the inner container

### FIX 3: Scene box click-to-expand detail panel

**Problem:** The `animate-in slide-in-from-bottom-2` class may not be available in the project's Tailwind config. Also, `max-h-[60%]` is relative to parent which may not have proper height.

**Solution:**
- Removed `animate-in slide-in-from-bottom-2 duration-200` classes
- Changed `max-h-[60%]` to fixed `max-h-[200px]`
- Added inline `style={{ transition: 'max-height 0.2s ease' }}` for smooth transition
- Reduced `mt-1.5` to `mt-1` and `pt-1.5` to `pt-1` for tighter spacing

### FIX 4: Scene box height reduction

**Problem:** Scene boxes could be more compact.

**Solution in `SortableGridItem` component:**
- Changed `gap-1 px-1 py-px` to `gap-0.5 px-0.5 py-0` for tighter padding
- Changed mini thumbnail from `w-6 h-4` to `w-5 h-3` for smaller size

### FIX 5: No additional changes needed
Control panel layout already well-organized with clear sections and dividers.

### FIX 6: No changes needed
Screen positions are correct: Screen 2 LEFT (Tiep theo), Screen 1 RIGHT (Dang chieu).

### Verification
- Lint check: 0 errors, 5 pre-existing warnings (alt-text only)
- Dev server compiling successfully
