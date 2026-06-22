import Link from "next/link";
import { getFileUrl } from "@/lib/cdn";
import { getClass9RegistrationSettings } from "@/queries/class9-registration.queries";

export const metadata = {
    title: "SSC Registration Notice",
};

export default async function Class9RegistrationNoticePage() {
    const data = await getClass9RegistrationSettings();
    const noticeUrl = data?.notice ? getFileUrl(data.notice) : null;
    const academicYear =
        data?.class9_year ?? data?.ssc_year ?? new Date().getFullYear();

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
                        SSC Registration Notice
                    </h1>

                    <div className="text-center mb-6">
                        <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                            Academic Year: {academicYear}
                        </span>
                    </div>

                    {noticeUrl ? (
                        <div className="mb-6">
                            <div className="border rounded-lg overflow-hidden">
                                <iframe
                                    src={`${noticeUrl}#navpanes=0&scrollbar=0`}
                                    className="w-full h-250"
                                    title="Class Nine Registration Notice"
                                />
                            </div>
                            <div className="mt-2 text-center">
                                <a
                                    href={noticeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline text-sm"
                                >
                                    Open in new tab / Download
                                </a>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-6 text-center py-8 text-gray-500">
                            <div className="text-4xl mb-2">📄</div>
                            <p>No registration notice available</p>
                        </div>
                    )}

                    <div className="text-center mt-8">
                        {data?.reg_open ? (
                            <Link
                                href="/registration/class-9/form"
                                className="bg-green-600 hover:bg-green-700 text-white! font-bold py-3 px-8 rounded-lg transition-colors duration-200 text-lg inline-block"
                            >
                                Proceed to Registration Form
                            </Link>
                        ) : (
                            <div className="text-center">
                                <button
                                    disabled
                                    className="bg-gray-400 text-white font-bold py-3 px-8 rounded-lg cursor-not-allowed text-lg"
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
