import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Shader } from '@/types/shader';
import { generateId } from '@/lib/utils';

interface ShaderState {
  shaders: Shader[];
  activeShaderId: string | null;
}

interface ShaderActions {
  addShader: (shader: Shader) => void;
  updateShader: (id: string, partial: Partial<Shader>) => void;
  deleteShader: (id: string) => void;
  setActive: (id: string | null) => void;
  duplicateShader: (id: string) => void;
}

export const useShaderStore = create<ShaderState & ShaderActions>()(
  persist(
    (set, get) => ({
      shaders: [],
      activeShaderId: null,

      addShader: (shader) =>
        set((state) => ({ shaders: [...state.shaders, shader] })),

      updateShader: (id, partial) =>
        set((state) => ({
          shaders: state.shaders.map((s) =>
            s.id === id ? { ...s, ...partial, updatedAt: Date.now() } : s
          ),
        })),

      deleteShader: (id) =>
        set((state) => ({
          shaders: state.shaders.filter((s) => s.id !== id),
          activeShaderId:
            state.activeShaderId === id ? null : state.activeShaderId,
        })),

      setActive: (id) => set({ activeShaderId: id }),

      duplicateShader: (id) => {
        const state = get();
        const shader = state.shaders.find((s) => s.id === id);
        if (!shader) return;
        const now = Date.now();
        const duplicate: Shader = {
          ...shader,
          id: generateId(),
          name: `${shader.name} (copy)`,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ shaders: [...state.shaders, duplicate] }));
      },
    }),
    {
      name: 'shadermmaker-shaders',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
