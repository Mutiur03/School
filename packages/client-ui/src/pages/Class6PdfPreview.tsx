import { Navigate, useParams } from "react-router-dom";
import backend from "../lib/backend";

function Class6PdfPreview() {
  const { id } = useParams();
  if (!id) return <Navigate to="/" replace />;

  const base = String(backend || "").trim().replace(/\/$/, "");
  const previewUrl = `${base}/api/reg/class-6/form/${id}/pdf?preview=1`;

  return (
    <div style={{ width: "100%", height: "100vh", background: "#fff" }}>
      <iframe
        title="Class 6 PDF Preview"
        src={previewUrl}
        style={{ width: "100%", height: "100%", border: "none" }}
      />
    </div>
  );
}

export default Class6PdfPreview;
