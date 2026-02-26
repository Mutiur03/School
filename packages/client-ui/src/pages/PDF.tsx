import { useLocation } from "react-router-dom"

function PDF() {
    console.log("✅ PDF component mounted")

    const location = useLocation()

    const iframeStyle = {
        width: "100%",
        height: "100vh",
        border: "none",
    }

    console.log("ENV VITE_BACKEND_URL =", import.meta.env.VITE_BACKEND_URL)
    console.log("window.location.origin =", window.location.origin)
    console.log("location.pathname =", location.pathname)

    const backend = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "")

    if (!backend) {
        console.error("❌ VITE_BACKEND_URL is NOT defined")
        return (
            <div style={{ padding: 20 }}>
                <h2>Configuration Error</h2>
                <p>VITE_BACKEND_URL is missing in production</p>
            </div>
        )
    }

    const rawPath = location.pathname.replace(/^\/pdf/, "")

    console.log("rawPath =", rawPath)

    let src = ""

    try {
        const decoded = decodeURIComponent(rawPath)
        const cleanPath = decoded.startsWith("/") ? decoded : "/" + decoded

        console.log("decoded =", decoded)
        console.log("cleanPath =", cleanPath)

        if (/^https?:\/\//i.test(cleanPath.slice(1))) {
            src = cleanPath.slice(1)
        } else {
            src = backend + cleanPath
        }
    } catch (err) {
        console.error("❌ decodeURIComponent failed:", err)
        src = backend + rawPath
    }

    console.log("🚀 FINAL PDF SRC =", src)

    return <div className="p-10">
        <iframe src={src} style={iframeStyle} title="PDF Viewer" />
    </div>
}

export default PDF
