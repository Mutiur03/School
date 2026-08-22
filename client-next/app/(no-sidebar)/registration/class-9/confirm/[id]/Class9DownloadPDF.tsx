'use client';

import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { downloadBlob } from '@school/common-ui/blob';
import type { SchoolConfig } from '@/types';
import type { Class9RegistrationRecord } from '@school/shared-schemas';

type Class9DownloadPDFProps = {
  title1?: string;
  title2?: string;
  schoolConfig: SchoolConfig;
  registration: Class9RegistrationRecord;
  pdfUrl: string;
};

export default function Class9DownloadPDF({
  title1 = 'Registration Confirmed!',
  title2 = 'Download Your SSC Registration Form',
  schoolConfig,
  registration,
  pdfUrl,
}: Class9DownloadPDFProps) {
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const handleDownloadPDF = async () => {
    try {
      setDownloadingPDF(true);
      const response = await axios.get(pdfUrl, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      downloadBlob(
        blob,
        `Class_9_Registration_${registration.student_name_en?.replace(/\s+/g, '_') || registration.roll}.pdf`,
      );
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
              <p className="mb-6 text-gray-600">
                Click the button below to download your registration form as a PDF.
              </p>
              <button
                onClick={handleDownloadPDF}
                disabled={downloadingPDF}
                className={`rounded-lg px-8 py-4 text-lg font-bold text-white transition-all ${
                  downloadingPDF
                    ? 'cursor-not-allowed bg-gray-400'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {downloadingPDF ? 'Downloading...' : 'Download PDF'}
              </button>
            </div>

            {(phone || email) && (
              <div className="border-t pt-6 text-center text-sm text-gray-500">
                <p>Need help? Contact the school office:</p>
                {phone ? <p>Phone: {phone}</p> : null}
                {email ? <p>Email: {email}</p> : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
