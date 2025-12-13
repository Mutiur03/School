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
        if (window.gtag) {
            window.gtag('config', 'G-KTFSVX10C3', { page_path: location.pathname });
        }
    }, [location]);

    return null;
}
