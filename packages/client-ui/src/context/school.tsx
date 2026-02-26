import * as React from "react";
import type { SchoolConfig, SchoolProviderProps } from "@/types";

const SchoolConfigContext = React.createContext<SchoolConfig | null>(null);

export function SchoolProvider({ config, children }: SchoolProviderProps) {
  return (
    <SchoolConfigContext.Provider value={config}>
      {children}
    </SchoolConfigContext.Provider>
  );
}

export function useSchoolConfig() {
  const ctx = React.useContext(SchoolConfigContext);
  if (!ctx) {
    throw new Error("useSchoolConfig must be used within SchoolProvider");
  }
  return ctx;
}
