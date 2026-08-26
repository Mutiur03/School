import Link from '@/components/Link';
import { getFileUrl } from '@/lib/cdn';
import { getClass9RegistrationSettings } from '@/queries/registration.queries';

export const metadata = {
  title: 'SSC Registration Notice',
};

export default async function Class9RegistrationNoticePage() {
  const data = await getClass9RegistrationSettings();
  const noticeUrl = data?.notice ? getFileUrl(data.notice) : null;
  const academicYear = data?.class9_year ?? data?.ssc_year ?? new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-lg bg-white p-4 shadow-md sm:p-6">
          <h1 className="mb-6 text-center text-2xl font-bold text-balance text-gray-800 sm:text-3xl">
            SSC Registration Notice
          </h1>

          <div className="mb-6 text-center">
            <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
              Academic Year: {academicYear}
            </span>
          </div>

          {noticeUrl ? (
            <div className="mb-6">
              <div className="overflow-hidden rounded-lg border">
                <iframe
                  src={`${noticeUrl}#navpanes=0&scrollbar=0`}
                  className="h-[min(70vh,900px)] min-h-[280px] w-full"
                  title="Class Nine Registration Notice"
                />
              </div>
              <div className="mt-2 text-center">
                <a
                  href={noticeUrl}
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
              <p>No registration notice available</p>
            </div>
          )}

          <div className="mt-8 text-center">
            {data?.reg_open ? (
              <Link
                href="/registration/class-9/form"
                className="inline-block w-full max-w-sm rounded-lg bg-green-600 px-6 py-3 text-center text-base font-bold text-white! transition-colors duration-200 hover:bg-green-700 sm:w-auto sm:px-8 sm:text-lg"
              >
                Proceed to Registration Form
              </Link>
            ) : (
              <div className="text-center">
                <button
                  disabled
                  className="inline-block w-full max-w-sm cursor-not-allowed rounded-lg bg-gray-400 px-6 py-3 text-center text-base font-bold text-white sm:w-auto sm:px-8 sm:text-lg"
                >
                  Registration Closed
                </button>
                <p className="mt-2 text-sm text-gray-600">
                  Registration is currently not available
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
