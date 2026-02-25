import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@school/client-ui/index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { Analytics, SchoolProvider } from "@school/client-ui";
import { schoolConfig } from "@/lib/info";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
        <SchoolProvider config={schoolConfig}>
          <Analytics measurementId="G-KTFSVX10C3" />
          <App />
        </SchoolProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
