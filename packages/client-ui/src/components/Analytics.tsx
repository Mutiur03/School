import * as React from "react";
import { useLocation } from "react-router-dom";

declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void;
    }
}

export type AnalyticsProps = {
    measurementId: string;
};

export function Analytics({ measurementId }: AnalyticsProps) {
    const location = useLocation();

    React.useEffect(() => {
        const timer = window.setTimeout(() => {
            if (window.gtag) {
                window.gtag("config", measurementId, {
                    page_path: location.pathname + location.search,
                    page_title: document.title,
                });
            }
        }, 100);

        return () => window.clearTimeout(timer);
    }, [location.pathname, location.search, measurementId]);

    return null;
}
