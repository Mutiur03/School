import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface NavigationState {
  isDirty: boolean;
  setDirty: (isDirty: boolean) => void;
  resetDirty: () => void;
}

const useNavigationStore = create<NavigationState>()(
  devtools((set) => ({
    isDirty: false,
    setDirty: (isDirty) => set({ isDirty }),
    resetDirty: () => set({ isDirty: false }),
  }))
);

export default useNavigationStore;
