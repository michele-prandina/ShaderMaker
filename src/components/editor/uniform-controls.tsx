"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { parseUniforms } from "@/lib/glsl/uniform-parser";
import type { UniformDef } from "@/types/shader";

function emitUniformChange(name: string, value: number | number[]) {
  window.dispatchEvent(
    new CustomEvent("uniform-change", { detail: { name, value } })
  );
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

function FloatControl({
  uniform,
  value,
  onChange,
}: {
  uniform: UniformDef;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-mono text-muted-foreground">
          {uniform.name}
        </label>
        <span className="text-xs font-mono text-muted-foreground tabular-nums">
          {value.toFixed(uniform.step < 1 ? 2 : 0)}
        </span>
      </div>
      <Slider
        min={uniform.min}
        max={uniform.max}
        step={uniform.step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

function IntControl({
  uniform,
  value,
  onChange,
}: {
  uniform: UniformDef;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-mono text-muted-foreground">
          {uniform.name}
        </label>
        <span className="text-xs font-mono text-muted-foreground tabular-nums">
          {value}
        </span>
      </div>
      <Slider
        min={uniform.min}
        max={uniform.max}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

function Vec2Control({
  uniform,
  value,
  onChange,
}: {
  uniform: UniformDef;
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const labels = ["x", "y"];
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-mono text-muted-foreground">
        {uniform.name}
      </label>
      {labels.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground w-3">
            {label}
          </span>
          <Slider
            min={uniform.min}
            max={uniform.max}
            step={uniform.step}
            value={[value[i]]}
            onValueChange={([v]) => {
              const next = [...value];
              next[i] = v;
              onChange(next);
            }}
            className="flex-1"
          />
          <span className="text-xs font-mono text-muted-foreground tabular-nums w-10 text-right">
            {value[i].toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Vec3ColorControl({
  uniform,
  value,
  onChange,
}: {
  uniform: UniformDef;
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const hex = rgbToHex(value[0], value[1], value[2]);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-mono text-muted-foreground">
          {uniform.name}
        </label>
        <span className="text-xs font-mono text-muted-foreground">{hex}</span>
      </div>
      <input
        type="color"
        value={hex}
        onChange={(e) => {
          const rgb = hexToRgb(e.target.value);
          onChange([rgb[0], rgb[1], rgb[2]]);
        }}
        className="w-full h-8 cursor-pointer rounded border border-border bg-transparent"
      />
    </div>
  );
}

function Vec3Control({
  uniform,
  value,
  onChange,
}: {
  uniform: UniformDef;
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const labels = ["x", "y", "z"];
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-mono text-muted-foreground">
        {uniform.name}
      </label>
      {labels.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground w-3">
            {label}
          </span>
          <Slider
            min={uniform.min}
            max={uniform.max}
            step={uniform.step}
            value={[value[i]]}
            onValueChange={([v]) => {
              const next = [...value];
              next[i] = v;
              onChange(next);
            }}
            className="flex-1"
          />
          <span className="text-xs font-mono text-muted-foreground tabular-nums w-10 text-right">
            {value[i].toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Vec4Control({
  uniform,
  value,
  onChange,
}: {
  uniform: UniformDef;
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const labels = ["x", "y", "z", "w"];
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-mono text-muted-foreground">
        {uniform.name}
      </label>
      {labels.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground w-3">
            {label}
          </span>
          <Slider
            min={uniform.min}
            max={uniform.max}
            step={uniform.step}
            value={[value[i]]}
            onValueChange={([v]) => {
              const next = [...value];
              next[i] = v;
              onChange(next);
            }}
            className="flex-1"
          />
          <span className="text-xs font-mono text-muted-foreground tabular-nums w-10 text-right">
            {value[i].toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function UniformControls({
  shaderId,
  code,
}: {
  shaderId: string;
  code: string;
}) {
  const uniforms = useMemo(() => parseUniforms(code), [code]);

  // Store uniform values in local state for performance (not in Zustand)
  const [values, setValues] = useState<Record<string, number | number[]>>({});

  // Initialize values when uniforms change
  const prevUniformsRef = useRef<string>("");
  useEffect(() => {
    const key = uniforms.map((u) => `${u.name}:${u.type}`).join(",");
    if (key !== prevUniformsRef.current) {
      prevUniformsRef.current = key;
      const initial: Record<string, number | number[]> = {};
      for (const u of uniforms) {
        // Keep existing value if uniform still exists, otherwise use default
        initial[u.name] = values[u.name] ?? u.value;
      }
      setValues(initial);

      // Emit initial values so the renderer picks them up
      for (const u of uniforms) {
        emitUniformChange(u.name, initial[u.name] ?? u.value);
      }
    }
  }, [uniforms]);

  const handleChange = useCallback(
    (name: string, value: number | number[]) => {
      setValues((prev) => ({ ...prev, [name]: value }));
      emitUniformChange(name, value);
    },
    []
  );

  if (uniforms.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-muted-foreground text-center">
        No user uniforms found.
        <br />
        <span className="text-[10px]">
          Add <code className="text-foreground">uniform float u_name;</code> to your shader.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-3 py-3">
      {uniforms.map((u) => {
        const val = values[u.name] ?? u.value;

        switch (u.type) {
          case "float":
            return (
              <FloatControl
                key={u.name}
                uniform={u}
                value={val as number}
                onChange={(v) => handleChange(u.name, v)}
              />
            );

          case "int":
            return (
              <IntControl
                key={u.name}
                uniform={u}
                value={val as number}
                onChange={(v) => handleChange(u.name, v)}
              />
            );

          case "vec2":
            return (
              <Vec2Control
                key={u.name}
                uniform={u}
                value={val as number[]}
                onChange={(v) => handleChange(u.name, v)}
              />
            );

          case "vec3": {
            const isColor = u.name.toLowerCase().includes("color");
            if (isColor) {
              return (
                <Vec3ColorControl
                  key={u.name}
                  uniform={u}
                  value={val as number[]}
                  onChange={(v) => handleChange(u.name, v)}
                />
              );
            }
            return (
              <Vec3Control
                key={u.name}
                uniform={u}
                value={val as number[]}
                onChange={(v) => handleChange(u.name, v)}
              />
            );
          }

          case "vec4":
            return (
              <Vec4Control
                key={u.name}
                uniform={u}
                value={val as number[]}
                onChange={(v) => handleChange(u.name, v)}
              />
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
