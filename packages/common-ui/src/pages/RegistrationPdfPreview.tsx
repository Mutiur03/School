import { useEffect, useMemo, useState } from 'react';

type ClassSlug = 'class-6' | 'class-8' | 'junior-scholarship' | 'class-9';
type PreviewMode = 'stored' | 'live';

type Props = {
  classSlug: ClassSlug;
  id: string;
  mode?: PreviewMode;
};

export default function RegistrationPdfPreview({ classSlug, id, mode = 'stored' }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    const params = new URLSearchParams();

    params.set('preview', mode === 'live' ? '1' : 'stored-inline');

    params.set('t', String(Date.now()));
    return `/api/reg/${classSlug}/form/${id}/pdf?${params.toString()}`;
  }, [classSlug, id, mode]);
  const label =
    classSlug === 'junior-scholarship'
      ? 'Junior Scholarship'
      : classSlug.replace('class-', 'Class ');

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    setIsLoading(true);
    setErrorMessage(null);
    setObjectUrl(null);

    (async () => {
      try {
        const res = await fetch(previewUrl, { credentials: 'include' });
        if (!res.ok) {
          let message = res.status === 404 ? 'Registration not found' : 'Failed to load PDF';
          try {
            const body = (await res.json()) as { message?: string };
            if (body?.message) message = body.message;
          } catch {
            // keep default message
          }
          if (!cancelled) {
            setErrorMessage(message);
            setIsLoading(false);
          }
          return;
        }

        const blob = await res.blob();
        createdUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(createdUrl);
          return;
        }
        setObjectUrl(createdUrl);
        setIsLoading(false);
      } catch {
        if (!cancelled) {
          setErrorMessage('Failed to load PDF');
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [previewUrl]);

  return (
    <div style={{ width: '100%', height: '100vh', background: '#fff', position: 'relative' }}>
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 3,
            background: 'rgba(0, 0, 0, 0.08)',
            zIndex: 10,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '35%',
              height: '100%',
              background: '#2563eb',
              animation: 'reg-pdf-loading 1.1s linear infinite',
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes reg-pdf-loading {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
      `}</style>

      {errorMessage ? (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            padding: 24,
            color: '#0f172a',
            fontFamily: 'system-ui, sans-serif',
            fontSize: 16,
            textAlign: 'center',
          }}
        >
          {errorMessage}
        </div>
      ) : objectUrl ? (
        <iframe
          title={`${label} PDF Preview`}
          src={objectUrl}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      ) : null}
    </div>
  );
}
