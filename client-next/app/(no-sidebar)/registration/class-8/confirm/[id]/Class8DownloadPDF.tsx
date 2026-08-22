'use client';

import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { downloadBlob } from '@school/common-ui/blob';
import type { SchoolConfig } from '@/types';
import type { Class8RegistrationRecord } from '@school/shared-schemas';

type Class8DownloadPDFProps = {
  title1?: string;
  title2?: string;
  schoolConfig: SchoolConfig;
  registration: Class8RegistrationRecord;
  pdfUrl: string;
};

export default function Class8DownloadPDF({
  title1 = 'Registration Confirmed!',
  title2 = 'Download Your Registration Form',
  schoolConfig,
  registration,
  pdfUrl,
}: Class8DownloadPDFProps) {
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const handleDownloadPDF = async () => {
    try {
      setDownloadingPDF(true);
      const response = await axios.get(pdfUrl, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      downloadBlob(blob, `Class8_Reg_${registration.student_name_en?.replace(/\s+/g, '_')}.pdf`);
    } catch {
      toast.error('Failed to download PDF');
    } finally {
      setDownloadingPDF(false);
    }
  };

  const phone = schoolConfig?.contact?.phone;
  const email = schoolConfig?.contact?.email;

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <div className="animate-fade-in mx-auto max-w-4xl">
        <div className="rounded-t bg-gray-800 p-8 text-center text-white">
          <div className="mb-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white">
              <svg
                className="h-12 w-12 text-gray-800"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
          <h1 className="mb-3 text-4xl font-bold">{title1}</h1>
          <p className="text-xl">Your registration has been successfully submitted</p>
        </div>

        <div className="overflow-hidden rounded-b bg-white shadow">
          <div className="space-y-8 p-8">
            <div className="text-center">
              <h2 className="mb-2 text-2xl font-bold text-gray-800">{title2}</h2>
              <p className="mb-6 text-lg text-gray-600">
                Download the PDF document and follow the instructions for the next steps.
              </p>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleDownloadPDF}
                disabled={downloadingPDF}
                className={`rounded px-8 py-4 text-lg font-semibold shadow transition-all duration-300 ${
                  downloadingPDF
                    ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                    : 'bg-gray-700 text-white hover:bg-gray-800'
                }`}
              >
                {downloadingPDF ? 'Generating PDF...' : 'Download PDF'}
              </button>
            </div>

            <div className="rounded border border-gray-200 bg-gray-50 p-6">
              <h3 className="mb-2 text-lg font-bold text-gray-800">Contact Information</h3>
              <div className="space-y-2 text-gray-600">
                <p>
                  <span className="font-medium">Phone:</span> {phone}
                </p>
                <p>
                  <span className="font-medium">Email:</span> {email}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
