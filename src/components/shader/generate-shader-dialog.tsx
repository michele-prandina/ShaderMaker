"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useShaderStore } from "@/stores/shader-store";
import { generateId } from "@/lib/utils";
import { DEFAULT_FRAGMENT_SHADER } from "@/lib/webgl/fullscreen-quad";
import { Loader2, Sparkles } from "lucide-react";

const MCP_URL = "http://localhost:3099";

interface GenerateShaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GenerateShaderDialog({ open, onOpenChange }: GenerateShaderDialogProps) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const pollCountRef = useRef(0);

  const addShader = useShaderStore((s) => s.addShader);
  const setActive = useShaderStore((s) => s.setActive);

  // Cleanup polling on unmount or close
  useEffect(() => {
    if (!open) {
      stopPolling();
      // Reset state when dialog closes
      if (!isGenerating) {
        setName("");
        setPrompt("");
        setError(null);
      }
    }
  }, [open, isGenerating]);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = undefined;
    }
    pollCountRef.current = 0;
  }

  function createShader(code: string, shaderName: string) {
    const id = generateId();
    addShader({
      id,
      name: shaderName || "New Shader",
      code,
      thumbnail: null,
      uniforms: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setActive(id);

    // Generate thumbnail after a short delay
    setTimeout(async () => {
      const { captureThumbnail } = await import("@/lib/webgl/thumbnail");
      const thumb = captureThumbnail(code);
      if (thumb) {
        useShaderStore.getState().updateShader(id, { thumbnail: thumb });
      }
    }, 500);
  }

  function handleCreateBlank() {
    createShader(DEFAULT_FRAGMENT_SHADER, name || "New Shader");
    resetAndClose();
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch(`${MCP_URL}/api/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), name: name.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit request");
      }

      const { id: requestId } = await res.json();
      pollCountRef.current = 0;

      // Poll every 2 seconds for up to 2 minutes
      pollRef.current = setInterval(async () => {
        pollCountRef.current++;

        if (pollCountRef.current > 60) {
          stopPolling();
          setIsGenerating(false);
          setError("Timed out waiting for shader generation. Please try again.");
          return;
        }

        try {
          const pollRes = await fetch(`${MCP_URL}/api/result/${requestId}`);
          if (!pollRes.ok) {
            stopPolling();
            setIsGenerating(false);
            setError("Request not found. The MCP server may have restarted.");
            return;
          }

          const data = await pollRes.json();
          if (data.status === "completed") {
            stopPolling();
            createShader(data.code, data.name || name || "AI Shader");
            resetAndClose();
          }
        } catch {
          // Network error during poll — keep trying
        }
      }, 2000);
    } catch (err) {
      setIsGenerating(false);
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to MCP server. Make sure it's running on port 3099."
      );
    }
  }

  function resetAndClose() {
    stopPolling();
    setIsGenerating(false);
    setName("");
    setPrompt("");
    setError(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isGenerating) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New Shader</DialogTitle>
          <DialogDescription>
            Describe the visual effect you want, and AI will generate the GLSL code for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Name (optional)</label>
            <Input
              placeholder="AI will suggest a name if left empty"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Describe your shader</label>
            <Textarea
              placeholder={"e.g. A swirling galaxy with glowing spiral arms and twinkling stars\n\nTip: mention colors, movement, interactivity (mouse), and mood"}
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && prompt.trim()) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
            />
          </div>

          {isGenerating && (
            <p className="text-sm text-muted-foreground">
              Waiting for AI to generate your shader... Tell Claude Code to &quot;check shader requests&quot;.
            </p>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleCreateBlank} disabled={isGenerating}>
            Create Blank
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate with AI
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
