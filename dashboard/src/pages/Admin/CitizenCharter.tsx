import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { uploadToR2 } from '@/lib/uploadToR2';
import { getFileUrl } from '@/lib/backend';

interface PDFData {
  file: string;
  updated_at: string;
  download_url: string;
}

interface UploadStatus {
  type: 'success' | 'error' | '';
  message: string;
}

function CitizenCharter() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ type: '', message: '' });
  const [currentPDF, setCurrentPDF] = useState<PDFData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCurrentPDF();
  }, []);

  const fetchCurrentPDF = async (): Promise<void> => {
    try {
      const response = await axios.get<PDFData>('/api/citizen-charter');
      setCurrentPDF(response.data);
    } catch {
      setCurrentPDF(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];

    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setUploadStatus({ type: '', message: '' });
    } else {
      setUploadStatus({
        type: 'error',
        message: 'Please select a valid PDF file',
      });
      setSelectedFile(null);
    }
  };

  const handleUpload = async (): Promise<void> => {
    if (!selectedFile) {
      setUploadStatus({ type: 'error', message: 'Please select a file first' });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus({ type: '', message: '' });

    try {
      const key = await uploadToR2(
        '/api/citizen-charter/presigned-url',
        selectedFile,
        setUploadProgress,
      );

      const response = await axios.post('/api/citizen-charter', { key });

      setUploadStatus({
        type: 'success',
        message: 'PDF uploaded successfully!',
      });
      setSelectedFile(null);
      setCurrentPDF(response.data.data);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
      setUploadStatus({
        type: 'error',
        message:
          axiosError.response?.data?.message ||
          axiosError.response?.data?.error ||
          'Failed to upload PDF. Please try again.',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const previewUrl = currentPDF ? getFileUrl(currentPDF.file) : '';
  const downloadUrl = currentPDF ? getFileUrl(currentPDF.download_url) : '';

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Citizen Charter Management</h1>

      <div className="grid-rows grid gap-6">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold">Upload Citizen Charter PDF</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="pdfUpload" className="mb-2 block text-sm font-medium text-gray-700">
                Select PDF File
              </label>
              <input
                ref={fileInputRef}
                id="pdfUpload"
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="text-muted-foreground block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {selectedFile && (
              <div className="text-muted-foreground text-sm">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}

            {isUploading && uploadProgress > 0 && (
              <div className="text-muted-foreground text-sm">Uploading: {uploadProgress}%</div>
            )}

            {uploadStatus.message && (
              <div
                className={`rounded-md p-3 ${
                  uploadStatus.type === 'success'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {uploadStatus.message}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="bg-primary hover:bg-primary/90 flex w-full items-center justify-center rounded-md px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isUploading ? (
                <>
                  <svg
                    className="mr-3 -ml-1 h-5 w-5 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                'Upload PDF'
              )}
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold">Current Citizen Charter</h2>

          {isLoading ? (
            <div className="bg-muted flex h-96 items-center justify-center rounded-lg">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : currentPDF ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  Last updated: {new Date(currentPDF.updated_at).toLocaleDateString()}
                </span>
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                >
                  Download PDF
                </a>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <iframe
                  src={previewUrl}
                  width="100%"
                  height="600"
                  title="Citizen Charter PDF"
                  className="h-[min(70vh,600px)] min-h-[240px] w-full border-0"
                >
                  <p>
                    Your browser doesn't support PDFs.{' '}
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                      Download the PDF
                    </a>
                  </p>
                </iframe>
              </div>
            </div>
          ) : (
            <div className="bg-muted flex h-96 items-center justify-center rounded-lg">
              <div className="text-muted-foreground text-center">
                <svg
                  className="mx-auto mb-4 h-12 w-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p>No Citizen Charter PDF uploaded yet</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CitizenCharter;
