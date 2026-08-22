import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPDF = async (): Promise<void> => {
    const res = await axios.get<PDFData[]>('/api/class-routine/pdf');
    setPDF(res.data[0] || null);
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

  return (
    <div className="bg-background border-border mx-auto mt-10 max-w-md rounded-xl border p-8 shadow-lg">
      {dialog}
      <h2 className="text-primary mb-6 text-2xl font-bold tracking-tight">Class Routine PDF</h2>
      {!pdf ? (
        <form onSubmit={handleUpload} className="mb-5 flex flex-col gap-3">
          <label htmlFor="routine-upload" className="text-foreground mb-1 block font-medium">
            Upload Routine PDF
          </label>
          <input
            id="routine-upload"
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            ref={fileInputRef}
            className="hidden"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-secondary text-secondary-foreground border-border hover:bg-accent rounded-md border px-4 py-2 font-semibold shadow-sm transition"
              disabled={uploading}
            >
              Choose File
            </button>
            <span className="text-muted-foreground text-sm">
              {file ? file.name : 'No file chosen'}
            </span>
          </div>
          <button
            type="submit"
            disabled={uploading || !file}
            className={`bg-primary text-primary-foreground mt-2 rounded-md px-6 py-2 font-semibold shadow-sm transition ${
              uploading || !file ? 'cursor-not-allowed opacity-60' : 'hover:bg-primary/90'
            }`}
          >
            {uploading ? `Uploading ${progress}%...` : 'Upload'}
          </button>
        </form>
      ) : (
        <div className="bg-background border-border mb-5 rounded-lg border p-5">
          <div className="mb-2">
            <b className="text-primary">Current Routine PDF:</b>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <a
              href={getFileUrl(pdf.pdf_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium underline"
            >
              View
            </a>
            <a
              href={getFileUrl(pdf.download_url)}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="text-input font-medium underline"
            >
              Download
            </a>
          </div>
          <form onSubmit={handleUpdate} className="flex flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                ref={fileInputRef}
                className="hidden"
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-secondary text-secondary-foreground border-border hover:bg-accent rounded-md border px-4 py-2 font-semibold transition"
                disabled={uploading}
              >
                Choose File
              </Button>
              <span className="text-muted-foreground min-w-[80px] self-center text-sm">
                {file ? file.name : 'No file chosen'}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <Button
                type="submit"
                disabled={uploading || !file}
                className={`bg-primary text-primary-foreground rounded-md px-4 py-2 font-semibold transition ${
                  uploading || !file ? 'cursor-not-allowed opacity-60' : 'hover:bg-primary/90'
                }`}
              >
                {uploading ? `Uploading ${progress}%...` : 'Update'}
              </Button>
              <Button variant="destructive" type="button" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </form>
        </div>
      )}
      {!pdf && (
        <div className="text-muted-foreground mt-6 text-center text-base">
          No routine PDF uploaded yet.
        </div>
      )}
    </div>
  );
}

export default ClassRoutinePDF;
