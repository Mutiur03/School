'use client';
import { createContext, useContext } from "react";
import { useState, useEffect } from "react";

export const AppContext = createContext<{
  sidebarExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;
}>({
  sidebarExpanded: false,
  setSidebarExpanded: () => { },
});

export default AppContext;

import { ReactNode } from "react";

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [sidebarExpanded, setSidebarExpanded] = useState(false); 

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSidebarExpanded(window.innerWidth >= 768);
    }
  }, []);

  return (
    <AppContext.Provider value={{ sidebarExpanded, setSidebarExpanded }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
