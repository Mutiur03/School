import { getFileUrl } from '@/lib/cdn';
import { getAdmissionData } from '@/queries/admission.queries';
import Link from '@/components/Link';

async function AdmissionFormNotice() {
  const { preview_url, download_url, admission_open } = await getAdmissionData();
  return (
    <div className="mx-auto max-w-4xl px-4">
      <div className="rounded-lg bg-white p-6 shadow-md">
        <h1 className="mb-6 text-center text-3xl font-bold text-gray-800">Admission Notice</h1>
        {preview_url ? (
          <div className="mb-6">
            <div className="overflow-hidden rounded-lg border">
              <iframe
                src={`${getFileUrl(preview_url)}#navpanes=0&scrollbar=0`}
                className="h-250 w-full"
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

        <div className="mt-8 text-center">
          {admission_open ? (
            <Link
              href="/admission/form"
              className="rounded-lg bg-green-600 px-8 py-3 text-lg font-bold text-white! transition-colors duration-200 hover:bg-green-700"
            >
              Proceed to Admission Form
            </Link>
          ) : (
            <div className="text-center">
              <button
                disabled
                className="cursor-not-allowed rounded-lg bg-gray-400 px-8 py-3 text-lg font-bold text-white"
              >
                Admission Closed
              </button>
              <p className="mt-2 text-sm text-gray-600">Admission is currently not available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdmissionFormNotice;
