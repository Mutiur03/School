'use client';

import axios from 'axios';
import { useLayoutEffect } from 'react';
import { Toaster } from 'react-hot-toast';

type ProvidersProps = {
  children: React.ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  useLayoutEffect(() => {
    axios.defaults.baseURL = '';
    // Always identify the school from the page the user is on (subdomain or custom domain).
    const tenantHost = window.location.hostname;
    if (tenantHost !== 'localhost' && tenantHost !== '127.0.0.1') {
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
