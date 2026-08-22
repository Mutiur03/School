import { getFileUrl } from '@/lib/backend';
import {
  AdmissionResult,
  getAdmissionResults,
  getAvailableAdmissionYears,
  getCurrentAdmissionYear,
  getSelectedAdmissionYear,
} from '@/queries/admission-results.queries';
import AcademicYearSelect from '../../results/AcademicYearSelect';

interface AdmissionResultPageProps {
  params: Promise<{
    class: string;
  }>;
  searchParams?: Promise<{
    year?: string;
  }>;
}

interface ListType {
  key: 'merit_list' | 'waiting_list_1' | 'waiting_list_2';
  label: string;
}

export const metadata = {
  title: 'Admission Result',
};

const listTypes: ListType[] = [
  { key: 'merit_list', label: '1st Result List' },
  { key: 'waiting_list_1', label: 'Waiting List 1' },
  { key: 'waiting_list_2', label: 'Waiting List 2' },
];

function FileStatus({ fileUrl }: { fileUrl: string | null }) {
  return fileUrl ? (
    <div className="flex items-center gap-1 text-green-600">
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span className="text-xs">Available</span>
    </div>
  ) : (
    <div className="flex items-center gap-1 text-gray-400">
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      <span className="text-xs">Not Available</span>
    </div>
  );
}

function NoResult({ classNumber }: { classNumber: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
      <svg
        className="mx-auto mb-4 h-16 w-16 text-gray-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
      </svg>
      <h3 className="mb-2 text-xl font-semibold text-gray-700">No Results Published Yet</h3>
      <p className="text-gray-500">
        Admission results for Class {classNumber} have not been published yet. Please check back
        later.
      </p>
    </div>
  );
}

function ResultDisplay({ result }: { result: AdmissionResult }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md">
      <div className="bg-linear-to-r from-blue-600 to-blue-700 p-6 text-white">
        <h2 className="mb-1 text-2xl font-bold">
          Class {result.class_name} - Admission {result.admission_year}
        </h2>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {listTypes.map((listType) => {
            const fileUrl = result[listType.key];

            return (
              <div
                key={listType.key}
                className="rounded-lg border border-gray-200 bg-gray-50 p-5 transition-shadow hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between">
                  <h4 className="text-base font-semibold text-gray-800">{listType.label}</h4>
                  <FileStatus fileUrl={fileUrl} />
                </div>

                {fileUrl ? (
                  <a
                    href={getFileUrl(fileUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white! transition-colors hover:bg-blue-700"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    View PDF
                  </a>
                ) : (
                  <div className="py-2 text-center text-sm text-gray-500">Not available yet</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-blue-900">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Important Instructions
          </h3>
          <ul className="space-y-2 text-sm text-blue-900">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 font-bold text-blue-600">&bull;</span>
              <span>Download and check your roll number carefully in the PDF file.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 font-bold text-blue-600">&bull;</span>
              <span>
                If you are on the waiting list, you will be notified if a seat becomes available.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 font-bold text-blue-600">&bull;</span>
              <span>For any queries, please contact the school administration office.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

async function AdmissionResultPage({ params, searchParams }: AdmissionResultPageProps) {
  const [{ class: classNumber }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const [currentAdmissionYear, results] = await Promise.all([
    getCurrentAdmissionYear(),
    getAdmissionResults(),
  ]);
  const admissionYear = getSelectedAdmissionYear(resolvedSearchParams?.year, currentAdmissionYear);
  const availableYears = getAvailableAdmissionYears(currentAdmissionYear);
  const result = results.find(
    (item) => item.class_name === classNumber && item.admission_year === admissionYear,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-800">
              Admission Result - Class {classNumber}
            </h1>
            <p className="text-gray-600">Academic Year: {admissionYear}</p>
          </div>

          <AcademicYearSelect
            years={availableYears}
            selectedYear={admissionYear}
            basePath={`/admission/result/${classNumber}`}
            label="Select Year:"
          />
        </div>
      </div>

      {result ? <ResultDisplay result={result} /> : <NoResult classNumber={classNumber} />}
    </div>
  );
}

export default AdmissionResultPage;
