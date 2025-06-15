import React, { useState } from 'react';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';

const PDFViewer = ({ fileUrl }: { fileUrl: string }) => {
    const [hasError, setHasError] = useState(false);
    const defaultLayoutPluginInstance = defaultLayoutPlugin();

    if (hasError) {
        return (
            <div style={{ padding: 20, color: 'red' }}>
                Failed to load PDF. Please check the file URL or disable any ad blockers.
                <br />
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">Open PDF in new tab</a>
            </div>
        );
    }

    return (
        <div style={{ height: '750px' }}>
            <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}>
                <Viewer
                    fileUrl={fileUrl}
                    plugins={[defaultLayoutPluginInstance]}
                    onError={() => setHasError(true)}
                />
            </Worker>
        </div>
    );
};

export default PDFViewer;
