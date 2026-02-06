"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ShaderList } from "@/components/shader/shader-list";
import { GenerateShaderDialog } from "@/components/shader/generate-shader-dialog";
import { useUIStore } from "@/stores/ui-store";
import { PanelLeftClose, Plus } from "lucide-react";

export function LeftSidebar() {
  const toggleLeft = useUIStore((s) => s.toggleLeftSidebar);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-sm font-semibold text-foreground">Shaders</h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialogOpen(true)}>
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
      <GenerateShaderDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
