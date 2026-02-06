"use client";

import { useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useShaderStore } from "@/stores/shader-store";

function CodeEditorInner({ shaderId, code }: { shaderId: string; code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null); // EditorView
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const currentShaderIdRef = useRef(shaderId);

  useEffect(() => {
    currentShaderIdRef.current = shaderId;
  }, [shaderId]);

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;

    async function setup() {
      const { EditorView } = await import("@codemirror/view");
      const { EditorState } = await import("@codemirror/state");
      const { basicSetup } = await import("codemirror");
      const { cpp } = await import("@codemirror/lang-cpp");

      if (destroyed) return;

      const darkTheme = EditorView.theme({
        "&": {
          backgroundColor: "oklch(0.205 0 0)",
          color: "#d4d4d8",
          height: "100%",
          fontSize: "13px",
        },
        ".cm-content": {
          fontFamily: "var(--font-geist-mono), monospace",
          caretColor: "#a1a1aa",
        },
        ".cm-cursor": { borderLeftColor: "#a1a1aa" },
        "&.cm-focused .cm-cursor": { borderLeftColor: "#e4e4e7" },
        ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.05)" },
        ".cm-selectionBackground, ::selection": { backgroundColor: "rgba(255,255,255,0.1) !important" },
        ".cm-gutters": {
          backgroundColor: "oklch(0.178 0 0)",
          color: "#52525b",
          border: "none",
        },
        ".cm-activeLineGutter": { backgroundColor: "rgba(255,255,255,0.05)" },
        ".cm-scroller": {
          scrollbarWidth: "thin",
          scrollbarColor: "oklch(1 0 0 / 10%) transparent",
        },
      }, { dark: true });

      const state = EditorState.create({
        doc: code,
        extensions: [
          basicSetup,
          cpp(),
          darkTheme,
          EditorView.updateListener.of((update: any) => {
            if (update.docChanged) {
              const newCode = update.state.doc.toString();
              clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => {
                useShaderStore.getState().updateShader(currentShaderIdRef.current, {
                  code: newCode,
                  updatedAt: Date.now(),
                });
              }, 300);
            }
          }),
          EditorView.lineWrapping,
        ],
      });

      const view = new EditorView({
        state,
        parent: containerRef.current!,
      });

      viewRef.current = view;
    }

    setup();

    return () => {
      destroyed = true;
      clearTimeout(debounceRef.current);
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, []); // Only mount once

  // Update document when shader changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc !== code) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: code },
      });
    }
  }, [shaderId, code]);

  return <div ref={containerRef} className="h-full overflow-auto" />;
}

// Dynamic import wrapper to avoid SSR
const CodeEditorDynamic = dynamic(
  () => Promise.resolve(CodeEditorInner),
  { ssr: false }
);

export function CodeEditor(props: { shaderId: string; code: string }) {
  return (
    <div className="h-full">
      <CodeEditorDynamic {...props} />
    </div>
  );
}
