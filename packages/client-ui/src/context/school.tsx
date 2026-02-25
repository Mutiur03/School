import * as React from "react";

type SchoolAssets = {
  logo?: string;
  headerLogo?: string;
  governmentLogo?: string;
  banners?: string[];
};

type SchoolMap = {
  embedUrl?: string;
};

type SchoolName = {
  en?: string;
  bn?: string;
  shortEn?: string;
};

export type SchoolConfig = {
  name?: SchoolName;
  assets?: SchoolAssets;
  map?: SchoolMap;
  backendBaseUrl?: string;
  links?: {
    results?: string;
    teacherLogin?: string;
    studentLogin?: string;
  };
  [key: string]: unknown;
};

const SchoolConfigContext = React.createContext<SchoolConfig | null>(null);

export type SchoolProviderProps = {
  config: SchoolConfig;
  children: React.ReactNode;
};

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
