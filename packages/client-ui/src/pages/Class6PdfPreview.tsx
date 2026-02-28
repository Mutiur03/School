import { Navigate, useParams } from "react-router-dom";
import { useState } from "react";
import backend from "../lib/backend";

function Class6PdfPreview() {
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  if (!id) return <Navigate to="/" replace />;

  const base = String(backend || "").trim().replace(/\/$/, "");
  const previewUrl = `${base}/api/reg/class-6/form/${id}/pdf?preview=1`;

  return (
    <div style={{ width: "100%", height: "100vh", background: "#fff", position: "relative" }}>
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: 3,
            background: "rgba(0, 0, 0, 0.08)",
            zIndex: 10,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "35%",
              height: "100%",
              background: "#2563eb",
              animation: "class6-pdf-loading 1.1s linear infinite",
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes class6-pdf-loading {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
      `}</style>

      <iframe
        title="Class 6 PDF Preview"
        src={previewUrl}
        style={{ width: "100%", height: "100%", border: "none" }}
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}

export default Class6PdfPreview;
