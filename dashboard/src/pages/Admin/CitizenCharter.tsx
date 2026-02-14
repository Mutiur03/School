import { useState, useEffect } from "react";
import axios from "axios";

interface PDFData {
  file: string;
  updated_at: string;
  download_url: string;
}

interface UploadStatus {
  type: "success" | "error" | "";
  message: string;
}

function CitizenCharter() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ type: "", message: "" });
  const [currentPDF, setCurrentPDF] = useState<PDFData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchCurrentPDF();
  }, []);

  const fetchCurrentPDF = async (): Promise<void> => {
    try {
      const response = await axios.get<PDFData>("/api/file-upload/citizen-charter");
      setCurrentPDF(response.data);
    } catch {
      setCurrentPDF(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];

    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      setUploadStatus({ type: "", message: "" });
    } else {
      setUploadStatus({
        type: "error",
        message: "Please select a valid PDF file",
      });
      setSelectedFile(null);
    }
  };

  const handleUpload = async (): Promise<void> => {
    if (!selectedFile) {
      setUploadStatus({ type: "error", message: "Please select a file first" });
      return;
    }

    setIsUploading(true);
    setUploadStatus({ type: "", message: "" });

    const formData = new FormData();
    formData.append("pdf", selectedFile);
    formData.append("type", "citizen_charter");

    try {
      const response = await axios.post(
        "/api/file-upload/citizen-charter",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setUploadStatus({
        type: "success",
        message: "PDF uploaded successfully!",
      });
      setSelectedFile(null);
      setCurrentPDF(response.data.data);
      const fileInput = document.getElementById("pdfUpload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (error) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      setUploadStatus({
        type: "error",
        message:
          axiosError.response?.data?.error ||
          "Failed to upload PDF. Please try again.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Citizen Charter Management</h1>

      <div className="grid grid-rows gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">
            Upload Citizen Charter PDF
          </h2>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="pdfUpload"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Select PDF File
              </label>
              <input
                id="pdfUpload"
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {selectedFile && (
              <div className="text-sm text-gray-600">
                Selected: {selectedFile.name} (
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}

            {uploadStatus.message && (
              <div
                className={`p-3 rounded-md ${uploadStatus.type === "success"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
                  }`}
              >
                {uploadStatus.message}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isUploading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                "Upload PDF"
              )}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">
            Current Citizen Charter
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : currentPDF ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  Last updated:{" "}
                  {new Date(currentPDF.updated_at).toLocaleDateString()}
                </span>
                <a
                  href={currentPDF.download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  Download PDF
                </a>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <iframe
                  src={currentPDF.file}
                  width="100%"
                  height="600"
                  title="Citizen Charter PDF"
                  className="border-0"
                >
                  <p>
                    Your browser doesn't support PDFs.{" "}
                    <a
                      href={currentPDF.file}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download the PDF
                    </a>
                  </p>
                </iframe>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
              <div className="text-center text-gray-500">
                <svg
                  className="w-12 h-12 mx-auto mb-4"
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
