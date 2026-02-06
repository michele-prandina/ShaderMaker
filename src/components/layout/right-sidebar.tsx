"use client";

import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CodeEditor } from "@/components/editor/code-editor";
import { UniformControls } from "@/components/editor/uniform-controls";
import { CompileStatus } from "@/components/editor/compile-status";
import { useUIStore } from "@/stores/ui-store";
import { useShaderStore } from "@/stores/shader-store";
import { PanelRightClose } from "lucide-react";

export function RightSidebar() {
  const toggleRight = useUIStore((s) => s.toggleRightSidebar);
  const activeShader = useShaderStore((s) =>
    s.shaders.find((sh) => sh.id === s.activeShaderId)
  );

  if (!activeShader) {
    return (
      <div className="flex h-full items-center justify-center bg-card text-muted-foreground">
        <p className="text-sm">Select a shader to edit</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="truncate text-sm font-semibold text-foreground">
          {activeShader.name}
        </h2>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleRight}>
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>
      <Separator />
      <CompileStatus />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <CodeEditor shaderId={activeShader.id} code={activeShader.code} />
        </div>
        <Separator />
        <ScrollArea className="max-h-[200px]">
          <UniformControls shaderId={activeShader.id} code={activeShader.code} />
        </ScrollArea>
      </div>
    </div>
  );
}
