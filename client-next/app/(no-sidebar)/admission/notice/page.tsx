import { getFileUrl } from '@/lib/cdn';
import { getAdmissionData } from '@/queries/admission.queries';

async function pages() {
  const { preview_url, download_url } = await getAdmissionData();
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h1 className="mb-6 text-center text-2xl font-bold text-balance text-gray-800 sm:text-3xl">
            Admission Notice
          </h1>
          {preview_url ? (
            <div className="mb-6">
              <div className="overflow-hidden rounded-lg border">
                <iframe
                  src={`${getFileUrl(preview_url)}#navpanes=0&scrollbar=0`}
                  className="h-[min(70vh,900px)] min-h-[280px] w-full"
                  title="Admission Notice"
                />
              </div>
              <div className="mt-2 text-center">
                <a
                  href={getFileUrl(download_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 underline hover:text-blue-800"
                >
                  Open in new tab / Download
                </a>
              </div>
            </div>
          ) : (
            <div className="mb-6 py-8 text-center text-gray-500">
              <div className="mb-2 text-4xl">📄</div>
              <p>No admission notice available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default pages;
