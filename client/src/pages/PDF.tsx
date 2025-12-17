function PDF() {
    const iframeStyle = {
        width: '100%',
        height: '100vh',
        border: 'none',
    }

    const backend = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || ''

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

    return <iframe src={src} style={iframeStyle} title="PDF Viewer" />
}

export default PDF
