"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ShaderList } from "@/components/shader/shader-list";
import { useShaderStore } from "@/stores/shader-store";
import { useUIStore } from "@/stores/ui-store";
import { PanelLeftClose, Plus } from "lucide-react";
import { DEFAULT_FRAGMENT_SHADER } from "@/lib/webgl/fullscreen-quad";
import { generateId } from "@/lib/utils";

export function LeftSidebar() {
  const addShader = useShaderStore((s) => s.addShader);
  const setActive = useShaderStore((s) => s.setActive);
  const toggleLeft = useUIStore((s) => s.toggleLeftSidebar);

  const handleNewShader = () => {
    const id = generateId();
    addShader({
      id,
      name: "New Shader",
      code: DEFAULT_FRAGMENT_SHADER,
      thumbnail: null,
      uniforms: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setActive(id);
  };

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-sm font-semibold text-foreground">Shaders</h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewShader}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleLeft}>
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <ShaderList />
      </ScrollArea>
    </div>
  );
}
