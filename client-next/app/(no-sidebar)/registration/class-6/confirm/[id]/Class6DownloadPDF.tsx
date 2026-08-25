'use client';

import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { downloadBlob } from '@school/common-ui/blob';
import type { SchoolConfig } from '@/types';
import type { Class6RegistrationRecord } from '@school/shared-schemas';

type Class6DownloadPDFProps = {
  title1?: string;
  title2?: string;
  schoolConfig: SchoolConfig;
  registration: Class6RegistrationRecord;
  pdfUrl: string;
};

export default function Class6DownloadPDF({
  title1 = 'Registration Confirmed!',
  title2 = 'Download Your Registration Form',
  schoolConfig,
  registration,
  pdfUrl,
}: Class6DownloadPDFProps) {
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const handleDownloadPDF = async () => {
    try {
      setDownloadingPDF(true);
      const response = await axios.get(pdfUrl, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      downloadBlob(blob, `Class6_Reg_${registration.student_name_en?.replace(/\s+/g, '_')}.pdf`);
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
              <div className="mb-4 inline-flex items-center justify-center rounded-full bg-gray-100 p-3">
                <svg
                  className="h-8 w-8 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
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
                {downloadingPDF ? (
                  <div className="flex items-center space-x-3">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></div>
                    <span>Generating PDF...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span>Download PDF</span>
                  </div>
                )}
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-1">
              <div className="rounded border border-gray-200 bg-gray-50 p-6">
                <div className="flex items-start space-x-3">
                  <div className="shrink-0">
                    <svg
                      className="h-6 w-6 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="mb-2 text-lg font-bold text-gray-800">Contact Information</h3>
                    <div className="space-y-2 text-gray-600">
                      {phone ? (
                        <p className="flex items-center space-x-2">
                          <span className="font-medium">Phone:</span> <span>{phone}</span>
                          <span>(Headmaster)</span>
                        </p>
                      ) : null}
                      {email ? (
                        <p className="flex items-center space-x-2">
                          <span className="font-medium">Email:</span> <span>{email}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
