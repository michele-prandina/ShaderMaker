"use client";

import { useShaderStore } from "@/stores/shader-store";
import { ShaderCard } from "@/components/shader/shader-card";

export function ShaderList() {
  const shaders = useShaderStore((s) => s.shaders);
  const activeShaderId = useShaderStore((s) => s.activeShaderId);

  if (shaders.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <p className="text-sm">No shaders yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {shaders.map((shader) => (
        <ShaderCard
          key={shader.id}
          shader={shader}
          isActive={shader.id === activeShaderId}
        />
      ))}
    </div>
  );
}
