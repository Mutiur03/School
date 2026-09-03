import { useMemo, useState } from 'react';

type ClassSlug = 'class-6' | 'class-8' | 'junior-scholarship' | 'class-9';
type PreviewMode = 'stored' | 'live';

type Props = {
  classSlug: ClassSlug;
  id: string;
  mode?: PreviewMode;
};

export default function RegistrationPdfPreview({ classSlug, id, mode = 'stored' }: Props) {
  const [isLoading, setIsLoading] = useState(true);

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

      <iframe
        title={`${label} PDF Preview`}
        src={previewUrl}
        style={{ width: '100%', height: '100%', border: 'none' }}
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}
