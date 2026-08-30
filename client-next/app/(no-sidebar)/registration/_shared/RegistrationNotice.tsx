import Link from '@/components/Link';
import { getFileUrl } from '@/lib/cdn';

type Settings = {
  notice?: string | null;
  reg_open?: boolean;
  [key: string]: unknown;
};

type Props = {
  title: string;
  formHref: string;
  statusHref: string;
  yearKey: string | readonly string[];
  getSettings: () => Promise<Settings>;
};

function pickYear(data: Settings, yearKey: string | readonly string[]) {
  const keys = typeof yearKey === 'string' ? [yearKey] : yearKey;
  for (const k of keys) {
    const v = data?.[k];
    if (v != null && v !== '') return v as string | number;
  }
  return new Date().getFullYear();
}

export default async function RegistrationNotice({
  title,
  formHref,
  statusHref,
  yearKey,
  getSettings,
}: Props) {
  const data = await getSettings();
  const noticeUrl = data?.notice ? getFileUrl(data.notice) : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-lg bg-white p-4 shadow-md sm:p-6">
          <h1 className="mb-6 text-center text-2xl font-bold text-balance text-gray-800 sm:text-3xl">
            {title}
          </h1>

          <div className="mb-6 text-center">
            <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
              Academic Year: {pickYear(data, yearKey)}
            </span>
          </div>

          {noticeUrl ? (
            <div className="mb-6">
              <div className="overflow-hidden rounded-lg border">
                <iframe
                  src={`${noticeUrl}#navpanes=0&scrollbar=0`}
                  className="h-[min(70vh,900px)] min-h-[280px] w-full"
                  title={title}
                />
              </div>
              {/* <div className="mt-2 text-center">
                <a
                  href={noticeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 underline hover:text-blue-800"
                >
                  Open in new tab / Download
                </a>
              </div> */}
            </div>
          ) : (
            <div className="mb-6 py-8 text-center text-gray-500">
              <div className="mb-2 text-4xl">📄</div>
              <p>No registration notice available</p>
            </div>
          )}

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {data?.reg_open ? (
              <Link
                href={formHref}
                className="inline-block w-full max-w-sm rounded-lg bg-green-600 px-6 py-3 text-center text-base font-bold text-white! transition-colors duration-200 hover:bg-green-700 sm:w-auto sm:px-8 sm:text-lg"
              >
                Registration Info Form
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

            <div className="text-center">
              <Link
                href={statusHref}
                className="inline-block w-full max-w-sm rounded-lg border border-[#609513] px-6 py-3 text-center text-base font-bold text-[#609513] transition-colors duration-200 hover:bg-[#609513]/10 hover:text-[#4f7f13] sm:w-auto sm:px-8 sm:text-lg"
              >
                Registration status
              </Link>
              {!data?.reg_open && <p className="invisible mt-2 text-sm">placeholder</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
