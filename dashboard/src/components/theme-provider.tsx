import { createContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

interface ThemeContextType {
  theme: string;
  setTheme: (newTheme: string) => void;
}

const ThemeProviderContext = createContext<ThemeContextType>({
  theme: "system",
  setTheme: () => { },
});

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: {
  children: ReactNode;
  defaultTheme?: string;
  storageKey?: string;
}) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem(storageKey) || defaultTheme;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (newTheme: string) => {
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider value={value} {...props}>
      {children}
    </ThemeProviderContext.Provider>
  );
}
export { ThemeProviderContext };
