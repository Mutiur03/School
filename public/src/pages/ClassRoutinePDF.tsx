"use client"
import { useEffect, useState } from "react";
import axios from "axios";

type RoutinePDF = {
    id: number;
    pdf_url: string;
    download_url: string;
    public_id: string;
    created_at: string;
};

export default function ClassRoutinePDF() {
    const [routinePDF, setRoutinePDF] = useState<RoutinePDF | null>(null);

    useEffect(() => {
        axios.get<RoutinePDF[]>("/api/class-routine/pdf")
            .then(res => setRoutinePDF(res.data[0] || null))
            .catch(() => setRoutinePDF(null));
    }, []);

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center py-10 px-2">
            <h1 className="section-title mb-6 text-2xl md:text-3xl text-center">Class Routine</h1>
            <div className="w-full max-w-3xl flex flex-col items-center justify-center mx-auto">
                {routinePDF ? (
                    <div className="w-full flex flex-col items-center gap-6">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2 w-full justify-center">
                            <span className="font-semibold text-primary text-center sm:text-left">Routine PDF:</span>
                            <a
                                href={routinePDF.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline font-medium"
                            >
                                View
                            </a>
                            <a
                                href={routinePDF.download_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                                className="text-secondary underline font-medium"
                            >
                                Download
                            </a>
                        </div>
                        <div className="w-full flex justify-center">
                            <div className="w-full bg-gray-100 rounded-lg overflow-hidden border border-border shadow aspect-video max-h-[90vh] min-h-[600px] flex items-center justify-center">
                                <iframe
                                    src={routinePDF.pdf_url}
                                    title="Class Routine PDF"
                                    className="w-full h-full"
                                    style={{
                                        border: "none",
                                        minHeight: "600px",
                                        maxHeight: "90vh"
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-muted-foreground text-center mb-6">
                        Routine PDF will be available soon.
                    </div>
                )}
            </div>
        </div>
    );
}