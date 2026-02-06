# ShaderMmaker - Implementation Plan

## Context

Build a single-page shader generator application from scratch. The project directory is empty - no source code, git, or dependencies exist yet. The goal is a performant, modern WebGL shader editor with a three-panel layout: shader list (left), live preview (center), and editor/tweaker (right).

**User choices:** Raw WebGL 2.0, fragment shaders only, 5-8 preset shaders, Zustand + localStorage for persistence.

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 15 (App Router) | SSR-capable, modern React patterns |
| Language | TypeScript (strict) | Type safety |
| Styling | Tailwind CSS + shadcn/ui | Consistent dark UI, Radix primitives |
| State | Zustand + persist middleware | Lightweight "database" in localStorage |
| Renderer | Raw WebGL 2.0 | Maximum perf, zero library overhead |
| Shaders | GLSL ES 3.00 (fragment only) | Modern, fullscreen-quad Shadertoy style |
| Code Editor | CodeMirror 6 | 124KB gzipped vs Monaco's 2MB+, modular, GLSL syntax support |
| Validation | Zod | Schema validation for shader data |

## File Structure

```
ShaderMmaker/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with ThemeProvider, fonts
│   │   ├── page.tsx            # Single page - the entire app
│   │   └── globals.css         # Tailwind + shadcn CSS variables
│   ├── components/
│   │   ├── layout/
│   │   │   ├── app-shell.tsx       # Three-panel responsive layout
│   │   │   ├── left-sidebar.tsx    # Shader list panel
│   │   │   └── right-sidebar.tsx   # Editor/tweaker panel
│   │   ├── shader/
│   │   │   ├── shader-canvas.tsx   # WebGL canvas component (useRef, imperative)
│   │   │   ├── shader-card.tsx     # Thumbnail card in left sidebar
│   │   │   └── shader-list.tsx     # Scrollable list of shader cards
│   │   ├── editor/
│   │   │   ├── code-editor.tsx     # CodeMirror 6 wrapper (dynamic import)
│   │   │   ├── uniform-controls.tsx # Auto-generated sliders/color pickers
│   │   │   └── compile-status.tsx  # Error display bar
│   │   └── ui/                     # shadcn/ui components (generated)
│   ├── lib/
│   │   ├── webgl/
│   │   │   ├── renderer.ts         # Core WebGL2 renderer (compile, link, draw)
│   │   │   ├── fullscreen-quad.ts  # Vertex shader + quad geometry
│   │   │   ├── shader-compiler.ts  # Compile + error parsing
│   │   │   └── thumbnail.ts        # Offscreen canvas thumbnail capture
│   │   ├── glsl/
│   │   │   ├── presets.ts           # 7 preset shader definitions
│   │   │   └── uniform-parser.ts   # Parse uniform declarations from GLSL
│   │   └── utils.ts                # Helpers (debounce, id generation)
│   ├── stores/
│   │   ├── shader-store.ts         # Zustand: shader CRUD, active shader, persist
│   │   └── ui-store.ts             # Zustand: sidebar states, editor visibility
│   └── types/
│       └── shader.ts               # Shader, Uniform, CompileResult types
├── components.json                  # shadcn/ui config
├── tailwind.config.ts
├── tsconfig.json
├── next.config.ts
└── package.json
```

## Implementation Steps

### Step 1: Project Scaffolding
- `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
- `git init`
- Install deps: `zustand`, `zod`, `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-cpp` (for GLSL syntax), `codemirror`
- Initialize shadcn/ui: `npx shadcn@latest init` (dark theme, neutral palette)
- Add shadcn components: `button`, `scroll-area`, `slider`, `input`, `separator`, `badge`, `tooltip`, `sheet`, `resizable`

### Step 2: Types & Stores
- **`src/types/shader.ts`**: Define `Shader` (id, name, code, thumbnail, uniforms, createdAt, updatedAt), `UniformDef` (name, type, value, min, max), `CompileResult`
- **`src/stores/shader-store.ts`**: Zustand store with `persist` middleware
  - State: `shaders[]`, `activeShaderId`, actions: `addShader`, `updateShader`, `deleteShader`, `setActive`, `duplicateShader`
  - Initialize with preset shaders on first load
- **`src/stores/ui-store.ts`**: `isRightSidebarOpen`, `isLeftSidebarCollapsed`, toggle actions

### Step 3: WebGL Rendering Engine (`src/lib/webgl/`)
- **`fullscreen-quad.ts`**: Vertex shader that draws a single fullscreen triangle (3 vertices, no buffer needed using `gl_VertexID`). GLSL ES 3.00.
- **`shader-compiler.ts`**: `compileShader(gl, source, type)` → returns `{success, shader?, errors[]}`. Parse error line numbers from WebGL compile log.
- **`renderer.ts`**: Core class (NOT a React class - plain TypeScript):
  - `init(canvas)` → get WebGL2 context, create VAO, set up fullscreen quad
  - `compile(fragmentSource)` → compile & link program
  - `render(time, resolution, mouse)` → set uniforms, draw
  - `destroy()` → cleanup
  - Context loss handling via event listeners
  - rAF loop managed here, NOT in React
- **`thumbnail.ts`**: `captureThumbnail(renderer, code)` → render 1 frame to offscreen canvas (128x128), return `dataURL`

### Step 4: GLSL Presets & Uniform Parser
- **`src/lib/glsl/presets.ts`**: 7 preset shaders:
  1. **Gradient** - Simple color gradient using UV coordinates
  2. **Plasma** - Classic plasma effect with sin/cos waves
  3. **Noise** - Simplex noise visualization (from skills reference)
  4. **Raymarching** - Basic sphere SDF (from skills reference)
  5. **Waves** - Animated sine wave pattern
  6. **Fractal** - Mandelbrot or Julia set
  7. **Voronoi** - Voronoi cell diagram
- **`src/lib/glsl/uniform-parser.ts`**: Regex parser to extract `uniform float/vec2/vec3/vec4/int` declarations from GLSL code. Returns `UniformDef[]` with sensible default ranges.

### Step 5: Layout & UI Shell
- **`src/app/layout.tsx`**: Root layout with dark theme, Inter/JetBrains Mono fonts
- **`src/app/globals.css`**: shadcn CSS variables for dark theme
- **`src/components/layout/app-shell.tsx`**: `'use client'` - Three-panel layout using CSS grid:
  - Left sidebar: 280px, collapsible
  - Center: flex-1 (canvas fills this)
  - Right sidebar: 400px, conditionally rendered when a shader is selected
  - Uses shadcn `ResizablePanelGroup` for drag-resizable panels

### Step 6: Shader Canvas Component
- **`src/components/shader/shader-canvas.tsx`**: `'use client'`
  - `useRef` for canvas element
  - `useEffect` to create renderer instance (imperative, outside React cycle)
  - Subscribe to Zustand store changes via `useEffect` + `subscribe` (not re-rendering)
  - When active shader code changes → debounced recompile (300ms)
  - Mouse tracking via canvas event listeners (not React events)
  - ResizeObserver for responsive canvas sizing
  - Cleanup on unmount

### Step 7: Left Sidebar (Shader List)
- **`src/components/shader/shader-list.tsx`**: Scrollable list of shader cards
- **`src/components/shader/shader-card.tsx`**: Thumbnail image, name, click to select
  - Active shader highlighted
  - Right-click context menu (rename, duplicate, delete) via shadcn
- "New Shader" button at top
- shadcn `ScrollArea` for overflow

### Step 8: Right Sidebar (Editor & Controls)
- **`src/components/editor/code-editor.tsx`**: `'use client'`, dynamic import of CodeMirror 6
  - GLSL syntax highlighting via `@codemirror/lang-cpp` (C-like syntax, close to GLSL)
  - Dark theme matching shadcn
  - onChange → debounced update to Zustand store
  - Line numbers, bracket matching
- **`src/components/editor/uniform-controls.tsx`**: Auto-parse uniforms from code
  - `float` → shadcn Slider
  - `vec3` with name containing "color" → color picker
  - `vec2` → dual sliders
  - Send uniform values to renderer imperatively
- **`src/components/editor/compile-status.tsx`**: Shows compile success/error with line numbers

### Step 9: Performance Optimizations
- WebGL canvas runs in its own rAF loop, decoupled from React
- CodeMirror loaded via `dynamic(() => import(...), { ssr: false })`
- Shader compilation debounced (300ms after last keystroke)
- Thumbnails generated lazily, only for visible cards
- CSS `will-change: transform` on sidebars for smooth slide animations
- React.memo on shader cards, only re-render when their specific data changes
- No unnecessary `useEffect` chains - direct Zustand subscriptions where possible

### Step 10: Polish
- Keyboard shortcuts: Ctrl+S to save, Ctrl+Enter to force recompile
- FPS counter in corner (optional toggle)
- Error gutter marks in CodeMirror matching GLSL compile errors
- Smooth sidebar open/close transitions
- Responsive: on small screens, sidebars become overlays

## Key Performance Architecture

```
React Land                          WebGL Land (imperative)
─────────────                       ────────────────────────
Zustand Store ──subscribe()──────→  Renderer.compile(code)
  shaders[]                         Renderer.setUniform(name, val)
  activeId                          rAF loop: Renderer.render()
                                    ↑
CodeMirror ──onChange(debounced)──→  Recompile only on change
  code edits
                                    Canvas (raw DOM, not React-managed)
```

The critical insight: **React never re-renders for animation frames.** The WebGL render loop runs independently. React only handles UI chrome (sidebars, lists, editor). Zustand acts as the bridge - UI writes to the store, WebGL subscribes imperatively.

## Verification

1. `npm run dev` → app loads with dark theme, three-panel layout
2. Left sidebar shows 7 preset shaders with thumbnails
3. Click a shader → canvas shows live preview at 60 FPS, right sidebar opens with code + controls
4. Edit GLSL code → live recompile after 300ms debounce, errors shown inline
5. Tweak uniform slider → instant visual feedback (no recompile)
6. Create new shader / duplicate / delete → persists across page refresh (localStorage)
7. Resize browser → canvas adapts, sidebars respond
8. Check DevTools Performance tab → no React re-renders during animation, smooth 60 FPS
