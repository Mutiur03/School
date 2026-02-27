import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { UnifiedAuthProvider } from "./context/unifiedAuthContext.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 300000, 
      refetchOnReconnect: true,
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
