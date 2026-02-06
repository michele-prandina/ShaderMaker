import { create } from 'zustand';

interface UiState {
  isLeftSidebarCollapsed: boolean;
  isRightSidebarOpen: boolean;
}

interface UiActions {
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setRightSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UiState & UiActions>()((set) => ({
  isLeftSidebarCollapsed: false,
  isRightSidebarOpen: true,

  toggleLeftSidebar: () =>
    set((state) => ({ isLeftSidebarCollapsed: !state.isLeftSidebarCollapsed })),

  toggleRightSidebar: () =>
    set((state) => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),

  setRightSidebarOpen: (open) => set({ isRightSidebarOpen: open }),
}));
