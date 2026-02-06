"use client";

import React, { useCallback } from "react";
import type { Shader } from "@/types/shader";
import { useShaderStore } from "@/stores/shader-store";
import { useUIStore } from "@/stores/ui-store";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

interface ShaderCardProps {
  shader: Shader;
  isActive: boolean;
}

export const ShaderCard = React.memo(function ShaderCard({
  shader,
  isActive,
}: ShaderCardProps) {
  const setActive = useShaderStore((s) => s.setActive);
  const updateShader = useShaderStore((s) => s.updateShader);
  const duplicateShader = useShaderStore((s) => s.duplicateShader);
  const deleteShader = useShaderStore((s) => s.deleteShader);
  const setRightSidebarOpen = useUIStore((s) => s.setRightSidebarOpen);

  const handleClick = useCallback(() => {
    setActive(shader.id);
    setRightSidebarOpen(true);
  }, [shader.id, setActive, setRightSidebarOpen]);

  const handleRename = useCallback(() => {
    const newName = window.prompt("Rename shader:", shader.name);
    if (newName && newName.trim() !== "") {
      updateShader(shader.id, { name: newName.trim() });
    }
  }, [shader.id, shader.name, updateShader]);

  const handleDuplicate = useCallback(() => {
    duplicateShader(shader.id);
  }, [shader.id, duplicateShader]);

  const handleDelete = useCallback(() => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${shader.name}"?`
    );
    if (confirmed) {
      deleteShader(shader.id);
    }
  }, [shader.id, shader.name, deleteShader]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            "w-full rounded-md border border-transparent p-1.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isActive && "ring-2 ring-primary bg-accent"
          )}
        >
          <div className="overflow-hidden rounded-sm">
            {shader.thumbnail ? (
              <img
                src={shader.thumbnail}
                alt={shader.name}
                className="h-20 w-full object-cover"
              />
            ) : (
              <div className="flex h-20 w-full items-center justify-center bg-muted">
                <span className="text-xs text-muted-foreground">
                  No preview
                </span>
              </div>
            )}
          </div>
          <p className="mt-1 truncate text-xs font-medium">{shader.name}</p>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={handleRename}>Rename</ContextMenuItem>
        <ContextMenuItem onSelect={handleDuplicate}>Duplicate</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={handleDelete}>
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
