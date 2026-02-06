"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

type CompileResult = {
  success: boolean;
  errors: { line: number; message: string }[];
};

export function CompileStatus() {
  const [result, setResult] = useState<CompileResult | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CompileResult>).detail;
      setResult(detail);
    };
    window.addEventListener("compile-result", handler);
    return () => window.removeEventListener("compile-result", handler);
  }, []);

  if (!result) return null;

  if (result.success) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
        <Badge variant="outline" className="bg-green-950 text-green-400 border-green-800 text-xs">
          Compiled OK
        </Badge>
      </div>
    );
  }

  return (
    <div className="border-b border-border px-3 py-1.5">
      <div className="flex flex-col gap-1">
        {result.errors.slice(0, 5).map((err, i) => (
          <div key={i} className="flex items-start gap-2">
            <Badge variant="outline" className="bg-red-950 text-red-400 border-red-800 text-xs shrink-0">
              Line {err.line}
            </Badge>
            <span className="text-xs text-red-400 font-mono truncate">{err.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
