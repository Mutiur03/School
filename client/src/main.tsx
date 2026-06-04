import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@school/client-ui/index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { Analytics, SchoolProvider } from "@school/client-ui";
import { schoolConfig } from "@/lib/info";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// const backendBaseUrl = String(import.meta.env.VITE_BACKEND_URL ?? "").trim();
import { init as initObserva } from "@mutiur03/observa-web";

const observaPublicKey = import.meta.env.VITE_OBSERVA_PUBLIC_KEY;

if (observaPublicKey) {
  initObserva({ apiKey: observaPublicKey, autoTrack: { webVitals: false } });
}

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
        <SchoolProvider config={{ ...schoolConfig }}>
          <Analytics measurementId="G-KTFSVX10C3" />
          <App />
        </SchoolProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
