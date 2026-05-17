---
Task ID: 1
Agent: main
Task: Build ShowFlow - Presentation Application

Work Log:
- Initialized Next.js 16 project with fullstack tooling
- Installed jszip for PPTX parsing and lucide-react for icons
- Created Zustand store (presentation-store.ts) with scene management, text overlays, live mode, black screen
- Created PPTX parser (pptx-parser.ts) that extracts slides as SVG from .pptx files
- Created MediaRenderer component supporting image, video, web, text, pptx-slide types
- Created AddSceneDialog with tabs for adding images, videos, web pages, text, and PPTX files
- Created SceneList with drag-and-drop reorder (dnd-kit) and text overlay panel
- Created PreviewPanel with dual preview (live + next) and control bar
- Created output page (/output) for projector screen with postMessage sync
- Built main page with resizable panels (vertical + horizontal)
- Added keyboard shortcuts (arrows, space, B)
- Applied dark theme, custom scrollbar, animations
- Fixed lint warnings and icon import issues

Stage Summary:
- ShowFlow presentation app is fully functional
- Supports: images, videos, web embeds, text slides, PPTX files
- Dual preview: large (current) + small (next)
- Dual-screen output via window.open with postMessage sync
- Drag-and-drop scene reordering
- Text notification overlays
- Keyboard shortcuts for control
- Dark theme optimized for presentation environments

---
Task ID: 2
Agent: main
Task: Add transition effects and swap preview positions

Work Log:
- Added 25 transition effects in 6 groups: Basic, Slide, Zoom, Wipe, 3D, Special
- New effects: Blur, Elastic, Bounce, Wipe Up/Down, Curtain Left/Right, Split H/V, Flip X, Spin, Glitch
- Upgraded TransitionRenderer to cross-transition (old scene exits + new scene enters simultaneously)
- Swapped preview positions: "Đang chiếu" (LIVE) is now on the RIGHT, "Tiếp theo" is on the LEFT
- Updated transition picker with grouped Select (SelectGroup + SelectLabel)
- Each transition has icon, label, and description
- Added all CSS animations for new transitions in globals.css
- Updated Output page to support cross-transition with prevScene tracking
- All animations use CSS `both` fill mode for proper enter/exit behavior

Stage Summary:
- 25 transition effects across 6 categories
- Cross-transition: old + new scene visible during transition
- Preview: "Đang chiếu" on RIGHT, "Tiếp theo" on LEFT
- Grouped transition selector with icons and descriptions

---
Task ID: 3
Agent: main
Task: Background playback, move controls down, PPTX slide navigator, volume control

Work Log:
- Fixed background playback: video keeps playing when user switches to another tab/app
  - Added visibilitychange + blur handlers to force play on focus loss
  - Added Screen Wake Lock API in output window to prevent browser throttling
  - Added playsInline attribute on video elements
- Moved all control buttons (navigation, transition, black screen, live/stop) to bottom control bar
  - Preview area is now clean with just the dual preview
  - ControlPanel component sits at the bottom of the page
- Added PPTX Slide Navigator
  - When current scene is a PPTX slide, the left panel transforms into a vertical slide thumbnail list
  - All slides from same PPTX file are grouped via pptxFileId
  - Click any thumbnail to jump to that slide
  - Active slide highlighted with green border + LIVE badge
- Added Volume Control for video scenes
  - Volume slider appears in control bar when current scene is video
  - Mute/unmute toggle button
  - Volume synced to output window via postMessage
- Added pptxFileId grouping for PPTX slides
  - All slides from one PPTX upload share the same pptxFileId
  - Enables slide navigator feature
- Restructured layout: header (minimal) → preview (top) → edit panels (middle) → control bar (bottom)

Stage Summary:
- Background playback works when switching apps
- All controls moved to bottom control bar
- PPTX slide navigator shows in left panel when viewing PPTX
- Volume control for video scenes
- Clean preview area with just the content
