function PDF() {
    const iframeStyle = {
        width: '100%',
        height: '100vh',
        border: 'none',
    }

    const backend = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || window.location.origin

    const rawPath = window.location.pathname.replace(/^\/pdf/, '')

    let src = ''

    try {
        const decoded = decodeURIComponent(rawPath)
        const cleanPath = decoded.startsWith('/') ? decoded.slice(1) : decoded
        if (/^https?:\/\//i.test(cleanPath)) {
            src = cleanPath
        }
        else {
            src = backend + decoded
        }
    } catch {
        src = backend + rawPath
    }
    console.log(src);

    if (!backend) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>
            <h2>Configuration Error</h2>
            <p>Backend URL not configured. Please contact administrator.</p>
        </div>
    }

    return <iframe src={src} style={iframeStyle} title="PDF Viewer" />
}
export default PDF;