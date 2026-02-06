"use client";

import { useEffect, useRef, useState } from "react";
import { useShaderStore } from "@/stores/shader-store";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { PanelLeftOpen, PanelRightOpen } from "lucide-react";

export function ShaderCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fpsRef = useRef({ frames: 0, lastTime: performance.now(), fps: 0 });
  const [showFps, setShowFps] = useState(false);
  const [fps, setFps] = useState(0);

  const isLeftCollapsed = useUIStore((s) => s.isLeftSidebarCollapsed);
  const isRightOpen = useUIStore((s) => s.isRightSidebarOpen);
  const toggleLeft = useUIStore((s) => s.toggleLeftSidebar);
  const setRightOpen = useUIStore((s) => s.setRightSidebarOpen);

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    let destroyed = false;

    async function init() {
      const { WebGLRenderer } = await import("@/lib/webgl/renderer");
      if (destroyed) return;

      const renderer = new WebGLRenderer();
      const success = renderer.init(canvasRef.current!);
      if (!success) {
        console.error("WebGL2 not supported");
        return;
      }

      rendererRef.current = renderer;

      // Compile the active shader
      const state = useShaderStore.getState();
      const activeShader = state.shaders.find((s) => s.id === state.activeShaderId);
      if (activeShader) {
        const result = renderer.compile(activeShader.code);
        window.dispatchEvent(
          new CustomEvent("compile-result", { detail: result })
        );
      }

      renderer.startLoop();
    }

    init();

    return () => {
      destroyed = true;
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, []);

  // FPS counter
  useEffect(() => {
    if (!showFps) return;

    const interval = setInterval(() => {
      const now = performance.now();
      const elapsed = now - fpsRef.current.lastTime;
      if (elapsed > 0) {
        setFps(Math.round((fpsRef.current.frames * 1000) / elapsed));
      }
      fpsRef.current.frames = 0;
      fpsRef.current.lastTime = now;
    }, 500);

    // Hook into rAF to count frames
    let rafId: number;
    const countFrame = () => {
      fpsRef.current.frames++;
      rafId = requestAnimationFrame(countFrame);
    };
    rafId = requestAnimationFrame(countFrame);

    return () => {
      clearInterval(interval);
      cancelAnimationFrame(rafId);
    };
  }, [showFps]);

  // Subscribe to shader store changes (imperative, no re-render)
  useEffect(() => {
    const unsub = useShaderStore.subscribe((state, prevState) => {
      const renderer = rendererRef.current;
      if (!renderer) return;

      const activeShader = state.shaders.find(
        (s) => s.id === state.activeShaderId
      );
      const prevActiveShader = prevState.shaders.find(
        (s) => s.id === prevState.activeShaderId
      );

      // If active shader changed or code changed, recompile
      if (
        activeShader &&
        (state.activeShaderId !== prevState.activeShaderId ||
          activeShader.code !== prevActiveShader?.code)
      ) {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          const result = renderer.compile(activeShader.code);
          window.dispatchEvent(
            new CustomEvent("compile-result", { detail: result })
          );
        }, 300);
      }
    });

    return () => {
      unsub();
      clearTimeout(debounceRef.current);
    };
  }, []);

  // Listen for custom uniform changes from the UI
  useEffect(() => {
    const handler = (e: Event) => {
      const { name, value } = (e as CustomEvent).detail;
      if (rendererRef.current) {
        rendererRef.current.setCustomUniform(name, value);
      }
    };
    window.addEventListener("uniform-change", handler);
    return () => window.removeEventListener("uniform-change", handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Enter: force recompile
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        const renderer = rendererRef.current;
        if (!renderer) return;
        const state = useShaderStore.getState();
        const activeShader = state.shaders.find((s) => s.id === state.activeShaderId);
        if (activeShader) {
          const result = renderer.compile(activeShader.code);
          window.dispatchEvent(new CustomEvent("compile-result", { detail: result }));
        }
      }
      // F toggle FPS when canvas is focused
      if (e.key === "f" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const active = document.activeElement;
        // Only toggle if not typing in an input/editor
        if (active === document.body || active === canvasRef.current || active === containerRef.current) {
          setShowFps((prev) => !prev);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ResizeObserver for responsive canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const dpr = window.devicePixelRatio || 1;
      const canvas = canvasRef.current;
      if (canvas && rendererRef.current) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        rendererRef.current.resize(canvas.width, canvas.height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Mouse tracking via DOM events (not React)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (rendererRef.current) {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        rendererRef.current.setMouse(
          (e.clientX - rect.left) * dpr,
          (rect.height - (e.clientY - rect.top)) * dpr
        );
      }
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    return () => canvas.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* Toggle buttons overlay */}
      <div className="absolute left-2 top-2 flex gap-1">
        {isLeftCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-black/50 text-white hover:bg-black/70"
            onClick={toggleLeft}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        )}
        {!isRightOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-black/50 text-white hover:bg-black/70"
            onClick={() => setRightOpen(true)}
          >
            <PanelRightOpen className="h-4 w-4" />
          </Button>
        )}
      </div>
      {/* FPS counter */}
      {showFps && (
        <div className="absolute right-2 top-2 rounded bg-black/70 px-2 py-1 font-mono text-xs text-green-400">
          {fps} FPS
        </div>
      )}
    </div>
  );
}
