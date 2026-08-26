'use client';

import axios from 'axios';
import { useLayoutEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { resolveClientAxiosBaseUrl } from '@/lib/resolveBackend';

type ProvidersProps = {
  children: React.ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  useLayoutEffect(() => {
    const baseURL = resolveClientAxiosBaseUrl();
    axios.defaults.baseURL = baseURL;
    // Custom domains call apisms cross-origin (no tenant-router). Host is the API
    // box, so the school must be identified the same way SSR/tenant-router do.
    if (baseURL) {
      const tenantHost = window.location.hostname;
      axios.defaults.headers.common['x-tenant-host'] = tenantHost;
      axios.defaults.headers.common['x-forwarded-host'] = tenantHost;
    }
  }, []);

  return (
    <>
      {children}
      <Toaster position="top-right" />
    </>
  );
}
