/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
declare global {
    interface Window {
        gtag: (...args: any[]) => void;
    }
}
export default function Analytics() {
    const location = useLocation();

    useEffect(() => {
        // Small delay to ensure the page component's useEffect has updated the document.title
        const timer = setTimeout(() => {
            if (window.gtag) {
                window.gtag('config', 'G-KTFSVX10C3', {
                    page_path: location.pathname + location.search,
                    page_title: document.title
                });
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [location]);

    return null;
}
