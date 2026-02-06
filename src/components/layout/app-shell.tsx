"use client";

import { useEffect } from "react";
import { LeftSidebar } from "@/components/layout/left-sidebar";
import { RightSidebar } from "@/components/layout/right-sidebar";
import { ShaderCanvas } from "@/components/shader/shader-canvas";
import { useShaderStore } from "@/stores/shader-store";
import { useUIStore } from "@/stores/ui-store";
import { PRESET_SHADERS } from "@/lib/glsl/presets";
import { generateId } from "@/lib/utils";

export function AppShell() {
  const isLeftCollapsed = useUIStore((s) => s.isLeftSidebarCollapsed);
  const isRightOpen = useUIStore((s) => s.isRightSidebarOpen);

  // Initialize preset shaders on first load (when store is empty)
  useEffect(() => {
    const state = useShaderStore.getState();
    if (state.shaders.length === 0) {
      const now = Date.now();
      for (const preset of PRESET_SHADERS) {
        const id = generateId();
        state.addShader({
          id,
          name: preset.name,
          code: preset.code,
          thumbnail: null,
          uniforms: [],
          createdAt: now,
          updatedAt: now,
        });
      }
      // Set the first shader as active
      const firstShader = useShaderStore.getState().shaders[0];
      if (firstShader) {
        state.setActive(firstShader.id);
      }
    }

    // Generate thumbnails lazily for shaders that don't have one
    setTimeout(async () => {
      const { captureThumbnail } = await import("@/lib/webgl/thumbnail");
      const currentState = useShaderStore.getState();
      for (const shader of currentState.shaders) {
        if (!shader.thumbnail) {
          const thumb = captureThumbnail(shader.code);
          if (thumb) {
            useShaderStore.getState().updateShader(shader.id, { thumbnail: thumb });
          }
        }
      }
    }, 1000);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Left Sidebar - Shader List */}
      {!isLeftCollapsed && (
        <div className="h-full w-[260px] min-w-[200px] shrink-0 overflow-hidden border-r border-border">
          <LeftSidebar />
        </div>
      )}

      {/* Center - Canvas */}
      <div className="relative h-full min-w-0 flex-1">
        <ShaderCanvas />
      </div>

      {/* Right Sidebar - Editor & Controls */}
      {isRightOpen && (
        <div className="h-full w-[400px] min-w-[300px] shrink-0 border-l border-border">
          <RightSidebar />
        </div>
      )}
    </div>
  );
}
