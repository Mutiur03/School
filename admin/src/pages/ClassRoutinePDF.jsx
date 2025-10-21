import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";

function ClassRoutinePDF() {
  const [pdf, setPDF] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef();

  const fetchPDF = async () => {
    const res = await axios.get("/api/class-routine/pdf");
    setPDF(res.data[0] || null);
  };

  useEffect(() => {
    fetchPDF();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("pdf", file);
    try {
      await axios.post("/api/class-routine/pdf", formData);
      setFile(null);
      fileInputRef.current.value = "";
      fetchPDF();
    } catch  {
      alert("Failed to upload PDF");
    }
    setUploading(false);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!file || !pdf) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("pdf", file);
    try {
      await axios.put(`/api/class-routine/pdf/${pdf.id}`, formData);
      setFile(null);
      fileInputRef.current.value = "";
      fetchPDF();
    } catch  {
      alert("Failed to update PDF");
    }
    setUploading(false);
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this PDF?")) return;
    await axios.delete(`/api/class-routine/pdf/${pdf.id}`);
    setPDF(null);
    setFile(null);
    fileInputRef.current.value = "";
    fetchPDF();
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-background rounded-xl shadow-lg p-8 border border-border">
      <h2 className="text-primary font-bold text-2xl mb-6 tracking-tight">
        Class Routine PDF
      </h2>
      {!pdf ? (
        <form onSubmit={handleUpload} className="mb-5 flex flex-col gap-3">
          <label
            htmlFor="routine-upload"
            className="block text-foreground font-medium mb-1"
          >
            Upload Routine PDF
          </label>
          <input
            id="routine-upload"
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files[0])}
            ref={fileInputRef}
            className="hidden"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current.click()}
              className="bg-secondary text-secondary-foreground rounded-md px-4 py-2 font-semibold shadow-sm border border-border transition hover:bg-accent"
              disabled={uploading}
            >
              Choose File
            </button>
            <span className="text-muted-foreground text-sm">
              {file ? file.name : "No file chosen"}
            </span>
          </div>
          <button
            type="submit"
            disabled={uploading || !file}
            className={`mt-2 bg-primary text-primary-foreground rounded-md px-6 py-2 font-semibold shadow-sm transition ${
              uploading || !file
                ? "opacity-60 cursor-not-allowed"
                : "hover:bg-primary/90"
            }`}
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </form>
      ) : (
        <div className="mb-5 bg-background rounded-lg p-5 border border-border">
          <div className="mb-2">
            <b className="text-primary">Current Routine PDF:</b>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <a
              href={pdf.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline font-medium"
            >
              View
            </a>
            <a
              href={pdf.download_url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="text-input underline font-medium"
            >
              Download
            </a>
           
          </div>
          <form onSubmit={handleUpdate} className="flex flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files[0])}
                ref={fileInputRef}
                className="hidden"
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current.click()}
                className="bg-secondary text-secondary-foreground rounded-md px-4 py-2 font-semibold border border-border transition hover:bg-accent"
                disabled={uploading}
              >
                Choose File
              </Button>
              <span className="self-center text-muted-foreground text-sm min-w-[80px]">
                {file ? file.name : "No file chosen"}
              </span>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <Button
                type="submit"
                disabled={uploading || !file}
                className={`bg-primary text-primary-foreground rounded-md px-4 py-2 font-semibold transition ${
                  uploading || !file
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:bg-primary/90"
                }`}
              >
                {uploading ? "Updating..." : "Update"}
              </Button>
              <Button
                variant={"destructive"}
                type="button"
                onClick={handleDelete}
                // className="bg-destructive text-destructive-foreground rounded-md px-4 py-2 font-semibold transition hover:bg-destructive/80"
              >
                Delete
              </Button>
            </div>
          </form>
        </div>
      )}
      {!pdf && (
        <div className="text-muted-foreground text-center mt-6 text-base">
          No routine PDF uploaded yet.
        </div>
      )}
    </div>
  );
}

export default ClassRoutinePDF;
