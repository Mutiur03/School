import Link from '@/components/Link';
import { getFileUrl } from '@/lib/cdn';
import { getClass8RegistrationSettings } from '@/queries/class8-registration.queries';

export const metadata = {
  title: 'Class Eight Registration Notice',
};

export default async function Class8RegistrationNoticePage() {
  const data = await getClass8RegistrationSettings();
  const noticeUrl = data?.notice ? getFileUrl(data.notice) : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h1 className="mb-6 text-center text-3xl font-bold text-gray-800">
            Class Eight Registration Notice
          </h1>

          <div className="mb-6 text-center">
            <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
              Academic Year: {data?.class8_year || new Date().getFullYear()}
            </span>
          </div>

          {noticeUrl ? (
            <div className="mb-6">
              <div className="overflow-hidden rounded-lg border">
                <iframe
                  src={`${noticeUrl}#navpanes=0&scrollbar=0`}
                  className="h-250 w-full"
                  title="Class Eight Registration Notice"
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
                href="/registration/class-8/form"
                className="inline-block rounded-lg bg-green-600 px-8 py-3 text-lg font-bold text-white! transition-colors duration-200 hover:bg-green-700"
              >
                Proceed to Registration Form
              </Link>
            ) : (
              <div className="text-center">
                <button
                  disabled
                  className="cursor-not-allowed rounded-lg bg-gray-400 px-8 py-3 text-lg font-bold text-white"
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
