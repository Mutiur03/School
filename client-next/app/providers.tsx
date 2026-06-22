"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import { useLayoutEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { resolveClientAxiosBaseUrl } from "@/lib/resolveBackend";

type ProvidersProps = {
    children: React.ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000,
                        refetchOnWindowFocus: false,
                    },
                },
            })
    );

    useLayoutEffect(() => {
        axios.defaults.baseURL = resolveClientAxiosBaseUrl();
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <Toaster position="top-right" />
        </QueryClientProvider>
    );
}
