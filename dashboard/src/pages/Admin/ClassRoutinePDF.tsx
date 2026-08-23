import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { FileText, Upload, Loader2 } from 'lucide-react';
import { PageHeader, SectionCard } from '@/components';
import { Button } from '@/components/ui/button';
import { uploadToR2 } from '@/lib/uploadToR2';
import { getFileUrl } from '@/lib/backend';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

interface PDFData {
  id: string;
  pdf_url: string;
  download_url: string;
}

function ClassRoutinePDF() {
  const { confirm, dialog } = useConfirmDialog();
  const [pdf, setPDF] = useState<PDFData | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPDF = async (): Promise<void> => {
    try {
      const res = await axios.get('/api/class-routine/pdf');
      setPDF(res.data.data[0] || null);
    } catch {
      setPDF(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPDF();
  }, []);

  const handleUpload = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const key = await uploadToR2('/api/class-routine/presigned-url', file, setProgress);
      await axios.post('/api/class-routine/pdf', { key });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchPDF();
    } catch {
      alert('Failed to upload PDF');
    }
    setUploading(false);
    setProgress(0);
  };

  const handleUpdate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!file || !pdf) return;
    setUploading(true);
    setProgress(0);
    try {
      const key = await uploadToR2('/api/class-routine/presigned-url', file, setProgress);
      await axios.put(`/api/class-routine/pdf/${pdf.id}`, { key });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchPDF();
    } catch {
      alert('Failed to update PDF');
    }
    setUploading(false);
    setProgress(0);
  };

  const handleDelete = async (): Promise<void> => {
    if (!pdf) return;
    const ok = await confirm({
      title: 'Delete PDF?',
      msg: 'Delete this class routine PDF?',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await axios.delete(`/api/class-routine/pdf/${pdf.id}`);
    setPDF(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    fetchPDF();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const selected = event.target.files?.[0];
    if (selected && selected.type === 'application/pdf') {
      setFile(selected);
    } else if (selected) {
      alert('Please select a valid PDF file');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else {
      setFile(null);
    }
  };

  const previewUrl = pdf ? getFileUrl(pdf.pdf_url) : '';
  const downloadUrl = pdf ? getFileUrl(pdf.download_url) : '';

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {dialog}
      <PageHeader
        title="Class Routine PDF"
        description="Upload and preview the class routine PDF for public display."
      />

      <SectionCard
        title={pdf ? 'Update Class Routine PDF' : 'Upload Class Routine PDF'}
        icon={<Upload size={20} />}
      >
        <form onSubmit={pdf ? handleUpdate : handleUpload} className="space-y-4">
          <div>
            <label htmlFor="routine-upload" className="mb-2 block text-sm font-medium">
              Select PDF File
            </label>
            <input
              ref={fileInputRef}
              id="routine-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              disabled={uploading}
              className="text-muted-foreground block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {file && (
            <div className="text-muted-foreground text-sm">
              Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}

          {uploading && progress > 0 && (
            <div className="text-muted-foreground text-sm">Uploading: {progress}%</div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={!file || uploading} className="w-full sm:w-auto">
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading {progress}%...
                </>
              ) : pdf ? (
                'Update PDF'
              ) : (
                'Upload PDF'
              )}
            </Button>
            {pdf && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={uploading}
                className="w-full sm:w-auto"
              >
                Delete
              </Button>
            )}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Current Class Routine" icon={<FileText size={20} />}>
        {isLoading ? (
          <div className="bg-muted/40 flex h-96 items-center justify-center rounded-lg">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        ) : pdf ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3 text-sm">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-medium underline"
                >
                  View
                </a>
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="text-primary font-medium underline"
                >
                  Download
                </a>
              </div>
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
                title="Class Routine PDF"
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
          <div className="bg-muted/40 flex h-96 items-center justify-center rounded-lg">
            <div className="text-muted-foreground text-center">
              <FileText className="mx-auto mb-4 h-12 w-12" />
              <p>No routine PDF uploaded yet</p>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default ClassRoutinePDF;
