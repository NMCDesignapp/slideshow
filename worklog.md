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
