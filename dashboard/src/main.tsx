import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { UnifiedAuthProvider } from "./context/unifiedAuthContext.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import backend from "./lib/backend.ts";

axios.defaults.baseURL = backend;
axios.defaults.withCredentials = true;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 600000, // 10 minutes
      gcTime: 900000, // 15 minutes
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <UnifiedAuthProvider>
        <BrowserRouter>
          {/* <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme"> */}
          <App />
          {/* </ThemeProvider> */}
        </BrowserRouter>
      </UnifiedAuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
