import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@school/client-ui/index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { Analytics, SchoolProvider } from "@school/client-ui";
import { schoolConfig } from "@/lib/info";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const backendBaseUrl = String(import.meta.env.VITE_BACKEND_URL ?? "").trim();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SchoolProvider config={{ ...schoolConfig, backendBaseUrl }}>
          <Analytics measurementId="G-KTFSVX10C3" />
          <App />
        </SchoolProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
