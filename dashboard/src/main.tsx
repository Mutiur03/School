import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { BrowserRouter } from 'react-router-dom';
import { UnifiedAuthProvider } from './context/unifiedAuthContext.tsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import backend from './lib/backend.ts';
import { initSentry, Sentry } from './lib/sentry.ts';
import {
  clearStaleChunkReloadGuard,
  isStaleChunkError,
  reloadOnceForStaleChunk,
} from './lib/lazyWithReload.ts';

axios.defaults.baseURL = backend;
axios.defaults.withCredentials = true;

initSentry();

// After a deploy, old tabs may request stale hashed chunks. Reload once to pick up the new asset map.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  reloadOnceForStaleChunk();
});

window.addEventListener('unhandledrejection', (event) => {
  if (!isStaleChunkError(event.reason)) return;
  if (reloadOnceForStaleChunk()) event.preventDefault();
});

window.addEventListener('load', () => {
  // Successful boot — allow a future deploy in this tab to recover again.
  window.setTimeout(() => clearStaleChunkReloadGuard(), 15_000);
});

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => (
        <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
          <p>Something went wrong loading this page.</p>
          <button
            type="button"
            onClick={() => {
              clearStaleChunkReloadGuard();
              resetError();
              window.location.reload();
            }}
          >
            Reload
          </button>
        </div>
      )}
      onError={(error) => {
        if (isStaleChunkError(error)) reloadOnceForStaleChunk();
      }}
    >
      <QueryClientProvider client={queryClient}>
        <UnifiedAuthProvider>
          <BrowserRouter>
            {/* <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme"> */}
            <App />
            {/* </ThemeProvider> */}
          </BrowserRouter>
        </UnifiedAuthProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
