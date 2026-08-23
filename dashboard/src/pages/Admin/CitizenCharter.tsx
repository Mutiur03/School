import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { uploadToR2 } from '@/lib/uploadToR2';
import { getFileUrl } from '@/lib/backend';
import { FileText, Upload, Loader2 } from 'lucide-react';
import { PageHeader, SectionCard } from '@/components';
import { Button } from '@/components/ui/button';

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
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Citizen Charter Management"
        description="Upload and preview the citizen charter PDF for public display."
      />

      <SectionCard title="Upload Citizen Charter PDF" icon={<Upload size={20} />}>
        <div className="space-y-4">
          <div>
            <label htmlFor="pdfUpload" className="mb-2 block text-sm font-medium">
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

          <Button onClick={handleUpload} disabled={!selectedFile || isUploading} className="w-full">
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              'Upload PDF'
            )}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Current Citizen Charter" icon={<FileText size={20} />}>
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
              <Button asChild variant="default" className="bg-green-600 hover:bg-green-700">
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                  Download PDF
                </a>
              </Button>
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
              <FileText className="mx-auto mb-4 h-12 w-12" />
              <p>No Citizen Charter PDF uploaded yet</p>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default CitizenCharter;
