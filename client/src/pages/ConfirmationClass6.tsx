import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { getFileUrl } from "@/lib/backend";
import { schoolConfig } from "@/lib/info";

type ConfirmationClass6_Props = {
    id?: string;
    // Personal Information
    student_name_bn?: string | null;
    student_name_en?: string | null;
    birth_reg_no?: string | null;
    registration_no?: string | null;

    father_name_bn?: string | null;
    father_name_en?: string | null;
    father_nid?: string | null;
    father_phone?: string | null;

    mother_name_bn?: string | null;
    mother_name_en?: string | null;
    mother_nid?: string | null;
    mother_phone?: string | null;

    birth_date?: string | null;
    birth_year?: string | null;
    birth_month?: string | null;
    birth_day?: string | null;
    email?: string | null;
    religion?: string | null;

    // Address
    present_district?: string | null;
    present_upazila?: string | null;
    present_post_office?: string | null;
    present_post_code?: string | null;
    present_village_road?: string | null;

    permanent_district?: string | null;
    permanent_upazila?: string | null;
    permanent_post_office?: string | null;
    permanent_post_code?: string | null;
    permanent_village_road?: string | null;

    // Guardian
    guardian_name?: string | null;
    guardian_phone?: string | null;
    guardian_relation?: string | null;
    guardian_nid?: string | null;
    guardian_district?: string | null;
    guardian_upazila?: string | null;
    guardian_post_office?: string | null;
    guardian_post_code?: string | null;
    guardian_village_road?: string | null;

    // Previous school
    prev_school_name?: string | null;
    prev_school_district?: string | null;
    prev_school_upazila?: string | null;
    section_in_prev_school?: string | null;
    roll_in_prev_school?: string | null;
    prev_school_passing_year?: string | null;

    // Class 6 Specific Meta
    section?: string | null;
    roll?: string | null;
    class6_year?: number | null;
    status?: string | null;
    nearby_student_info?: string | null;
    photo_path?: string | null;
    photo?: string | null;
    [key: string]: unknown;
};

function Class6RegConfirmation() {
    useEffect(() => {
        document.title = "Class 6 Registration Confirmation";
    }, []);
    const { id } = useParams<{ id: string }>();
    const [registration, setRegistration] =
        useState<ConfirmationClass6_Props | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    const [downloadingPDF, setDownloadingPDF] = useState(false);

    useEffect(() => {
        if (id) {
            fetchRegistrationData(id);
        }
    }, [id]);

    const fetchRegistrationData = async (regId: string) => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/reg/class-6/form/${regId}`);
            if (response.data.success) {
                setRegistration(response.data.data);
                if (response.data.data.status === "approved") {
                    setIsConfirmed(true);
                    setShowInstructions(true);
                }
            } else {
                setError("Registration not found");
                toast.error("Registration not found");
            }
        } catch (error: unknown) {
            console.error("Error fetching registration:", error);
            let message = "Failed to fetch registration data";
            if (axios.isAxiosError(error)) {
                message = error.response?.data?.message || message;
            } else if (error instanceof Error) {
                message = error.message;
            }
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmRegistration = async () => {
        if (!registration || registration.status === "approved") return;

        try {
            setConfirming(true);
            const response = await axios.put(
                `/api/reg/class-6/form/${registration.id}/status`,
                {
                    status: "approved",
                },
            );

            if (response.data.success) {
                toast.success("Registration confirmed successfully!");
                setIsConfirmed(true);

                setTimeout(() => {
                    setShowInstructions(true);
                }, 1000);
            } else {
                toast.error("Failed to confirm registration");
            }
        } catch (error: unknown) {
            console.error("Error confirming registration:", error);
            toast.error("Failed to confirm registration");
        } finally {
            setConfirming(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!registration) return;
        try {
            setDownloadingPDF(true);
            const response = await axios.get(
                `/api/reg/class-6/form/${registration.id}/pdf`,
                { responseType: "blob" },
            );
            const blob = new Blob([response.data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Class6_Reg_${registration.student_name_en?.replace(/\s+/g, "_")}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            toast.error("Failed to download PDF");
        } finally {
            setDownloadingPDF(false);
        }
    };

    const renderTableRow = (
        label: string,
        value: string | number | boolean | null | undefined,
    ) => (
        <tr className="border-b last:border-b-0 align-top border-gray-100">
            <td
                className="py-2 px-4 font-medium text-gray-700 bg-gray-50 align-top"
                style={{ width: "35%", minWidth: "200px" }}
            >
                <div className="whitespace-normal wrap-break-word">{label}</div>
            </td>
            <td className="py-2 px-4 align-top" style={{ width: "65%" }}>
                <div className="whitespace-normal wrap-break-word">
                    {value === null || value === undefined || value === "" ? (
                        <span className="text-gray-400">Not provided</span>
                    ) : typeof value === "boolean" ? (
                        value ? (
                            "Yes"
                        ) : (
                            "No"
                        )
                    ) : (
                        value.toString()
                    )}
                </div>
            </td>
        </tr>
    );

    const joinAddr = (
        village?: string | null,
        postOffice?: string | null,
        postCode?: string | null,
        upazila?: string | null,
        district?: string | null,
    ) => {
        return (
            [
                village ?? "",
                postOffice
                    ? postCode
                        ? `${postOffice} (${postCode})`
                        : postOffice
                    : "",
                upazila ?? "",
                district ?? "",
            ]
                .filter(Boolean)
                .map((s) => s.toString().trim())
                .filter((s) => s.length > 0)
                .join(", ") || null
        );
    };

    const renderOptionalRow = (
        label: string,
        value: string | number | boolean | null | undefined,
    ) => {
        if (value === null || value === undefined) return null;
        if (typeof value === "string" && value.trim() === "") return null;
        return renderTableRow(label, value);
    };

    const formatDateLong = (dateStr?: string | null) => {
        if (!dateStr) return "";
        let d: string, m: string, y: string;
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
            [d, m, y] = dateStr.split("/");
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            [y, m, d] = dateStr.split("-");
        } else {
            return dateStr;
        }
        const dateObj = new Date(`${y}-${m}-${d}`);
        if (isNaN(dateObj.getTime())) return dateStr;
        return dateObj
            .toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
            })
            .replace(/(\w+)\s(\d{4})/, "$1, $2");
    };

    const formatMobileNumbers = () => {
        const nums = [
            registration?.father_phone ?? "",
            registration?.mother_phone ?? "",
        ]
            .filter(Boolean)
            .join(", ");
        return nums || null;
    };

    const formatPreviousSchool = () => {
        return (
            [
                registration?.prev_school_name,
                registration?.prev_school_upazila,
                registration?.prev_school_district,
            ]
                .filter(Boolean)
                .join(", ") || null
        );
    };

    const formatPreviousSchoolMeta = () => {
        if (!registration) return null;
        const parts: string[] = [];
        if (
            registration.section_in_prev_school &&
            String(registration.section_in_prev_school).trim() !== ""
        ) {
            parts.push(`Section: ${registration.section_in_prev_school}`);
        }
        if (
            registration.roll_in_prev_school &&
            String(registration.roll_in_prev_school).trim() !== ""
        ) {
            parts.push(`Roll: ${registration.roll_in_prev_school}`);
        }
        if (
            registration.prev_school_passing_year &&
            String(registration.prev_school_passing_year).trim() !== ""
        ) {
            parts.push(`Year: ${registration.prev_school_passing_year}`);
        }
        return parts.length > 0 ? parts.join(" / ") : null;
    };

    const formatGuardianInfo = () => {
        if (!registration) return null;
        if (
            !registration.guardian_name &&
            !registration.guardian_phone &&
            !registration.guardian_relation &&
            !registration.guardian_nid
        ) {
            return null;
        }
        return (
            [
                registration?.guardian_name ? `Name: ${registration?.guardian_name}` : "",
                registration?.guardian_relation
                    ? `Relation: ${registration?.guardian_relation}`
                    : "",
                registration?.guardian_phone
                    ? `Phone: ${registration?.guardian_phone}`
                    : "",
                registration?.guardian_nid ? `NID: ${registration?.guardian_nid}` : "",
            ]
                .filter(Boolean)
                .join(", ") || null
        );
    };

    const formatGuardianAddress = () => {
        if (!registration) return null;
        const address = joinAddr(
            registration?.guardian_village_road ?? "",
            registration?.guardian_post_office ?? "",
            registration?.guardian_post_code ?? "",
            registration?.guardian_upazila ?? "",
            registration?.guardian_district ?? "",
        );
        return address || null;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh] bg-gray-100">
                <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-gray-600"></div>
            </div>
        );
    }

    if (error || !registration) {
        return (
            <div className="flex justify-center items-center min-h-[60vh] bg-gray-100">
                <div className="bg-white border border-gray-300 rounded p-8 shadow max-w-md w-full text-center">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
                    <p className="text-gray-600">{error || "Registration not found"}</p>
                </div>
            </div>
        );
    }

    if (showInstructions) {
        return (
            <div className="min-h-screen bg-gray-100 py-8 px-4">
                <div className="max-w-4xl mx-auto animate-fade-in">
                    <div className="bg-gray-800 text-white p-8 text-center rounded-t">
                        <div className="mb-6">
                            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-white">
                                <svg
                                    className="w-12 h-12 text-gray-800"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M5 13l4 4L19 7"
                                    ></path>
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-4xl font-bold mb-3">Registration Confirmed!</h1>
                        <p className="text-xl">
                            Your application has been successfully submitted
                        </p>
                    </div>

                    <div className="bg-white shadow rounded-b overflow-hidden">
                        <div className="p-8 space-y-8">
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center p-3 bg-gray-100 rounded-full mb-4">
                                    <svg
                                        className="w-8 h-8 text-gray-600"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                        />
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                                    Download Your Registration Form
                                </h2>
                                <p className="text-gray-600 text-lg mb-6">
                                    Download the PDF document and follow the instructions for the
                                    next steps.
                                </p>
                            </div>

                            <div className="flex justify-center">
                                <button
                                    onClick={handleDownloadPDF}
                                    disabled={downloadingPDF}
                                    className={`px-8 py-4 rounded font-semibold text-lg transition-all duration-300 shadow ${downloadingPDF
                                        ? "bg-gray-300 cursor-not-allowed text-gray-500"
                                        : "bg-gray-700 text-white hover:bg-gray-800"
                                        }`}
                                >
                                    {downloadingPDF ? (
                                        <div className="flex items-center space-x-3">
                                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-400 border-t-transparent"></div>
                                            <span>Generating PDF...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center space-x-3">
                                            <svg
                                                className="w-6 h-6"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="2"
                                                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                                />
                                            </svg>
                                            <span>Download PDF</span>
                                        </div>
                                    )}
                                </button>
                            </div>

                            <div className="grid md:grid-cols-1 gap-6">
                                <div className="bg-gray-50 border border-gray-200 p-6 rounded">
                                    <div className="flex items-start space-x-3">
                                        <div className="shrink-0">
                                            <svg
                                                className="w-6 h-6 text-gray-600"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="2"
                                                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                                />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-lg mb-2">
                                                Contact Information
                                            </h3>
                                            <div className="space-y-2 text-gray-600">
                                                <p className="flex items-center space-x-2">
                                                    <span className="font-medium">Phone:</span>{" "}
                                                    <span>{schoolConfig.contact.phone}</span>
                                                </p>
                                                <p className="flex items-center space-x-2">
                                                    <span className="font-medium">Email:</span>{" "}
                                                    <span>{schoolConfig.contact.email}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const photoSrc =
        typeof registration.photo === "string" && registration.photo
            ? registration.photo
            : registration.photo_path;

    return (
        <div className="w-full min-h-screen bg-gray-100 py-8 px-4">
            <div
                className={`max-w-4xl mx-auto transition-all duration-1000 ${isConfirmed ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"}`}
            >
                <div className="bg-gray-800 text-white p-6 sm:p-8 rounded-t">
                    <h1 className="text-2xl sm:text-3xl font-bold">
                        Registration Confirmation
                    </h1>
                    <p className="mt-2 text-sm sm:text-base">
                        Please review your information and confirm if everything is correct.
                    </p>
                </div>

                {photoSrc && (
                    <div className="bg-white p-6 border-b border-gray-200 flex flex-col items-center">
                        <h3 className="text-base font-semibold mb-2 text-gray-700">
                            Student's Photo
                        </h3>
                        <img
                            src={getFileUrl(photoSrc)}
                            alt="Student Photo"
                            className="w-28 h-28 object-cover border-2 border-gray-300 rounded shadow-sm"
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                            }}
                        />
                    </div>
                )}

                <div className="bg-white p-4 sm:p-8 space-y-8">
                    <div className="text-sm font-medium text-gray-800 border border-gray-200 rounded px-3 py-2 bg-gray-50 flex flex-wrap gap-x-4 gap-y-1">
                        {registration.class6_year ? (
                            <span>Year: {registration.class6_year}</span>
                        ) : null}
                        {registration.section ? (
                            <span>Section: {registration.section}</span>
                        ) : null}
                        {registration.roll ? <span>Roll: {registration.roll}</span> : null}
                        {registration.religion ? (
                            <span>Religion: {registration.religion}</span>
                        ) : null}
            
                    </div>

                    <div className="grid gap-8">
                        <div className="border border-gray-200 bg-white rounded">
                            <div className="overflow-x-auto">
                                <table
                                    className="w-full text-sm table-auto md:table-fixed"
                                    style={{ minWidth: "600px" }}
                                >
                                    <tbody>
                                        {renderOptionalRow(
                                            "ছাত্রের নাম:",
                                            registration.student_name_bn,
                                        )}
                                        {renderOptionalRow(
                                            "Student's Name:",
                                            registration.student_name_en
                                                ? registration.student_name_en.toUpperCase()
                                                : undefined,
                                        )}
                                        {renderOptionalRow(
                                            "Birth Registration Number:",
                                            registration.birth_reg_no,
                                        )}
                                        {renderOptionalRow(
                                            "Date of Birth:",
                                            formatDateLong(registration.birth_date),
                                        )}
                                        {renderOptionalRow("Email Address:", registration.email)}
                                        {renderOptionalRow(
                                            "Mobile Numbers:",
                                            formatMobileNumbers(),
                                        )}
                                        {renderOptionalRow("পিতার নাম:", registration.father_name_bn)}
                                        {renderOptionalRow(
                                            "Father's Name:",
                                            registration.father_name_en
                                                ? registration.father_name_en.toUpperCase()
                                                : undefined,
                                        )}
                                        {renderOptionalRow(
                                            "Father's National ID Number:",
                                            registration.father_nid,
                                        )}
                                        {renderOptionalRow("মাতার নাম:", registration.mother_name_bn)}
                                        {renderOptionalRow(
                                            "Mother's Name:",
                                            registration.mother_name_en
                                                ? registration.mother_name_en.toUpperCase()
                                                : undefined,
                                        )}
                                        {renderOptionalRow(
                                            "Mother's National ID Number:",
                                            registration.mother_nid,
                                        )}
                                        {renderOptionalRow(
                                            "Permanent Address:",
                                            joinAddr(
                                                registration.permanent_village_road,
                                                registration.permanent_post_office,
                                                registration.permanent_post_code,
                                                registration.permanent_upazila,
                                                registration.permanent_district,
                                            ),
                                        )}
                                        {renderOptionalRow(
                                            "Present Address:",
                                            joinAddr(
                                                registration.present_village_road,
                                                registration.present_post_office,
                                                registration.present_post_code,
                                                registration.present_upazila,
                                                registration.present_district,
                                            ),
                                        )}
                                        {renderOptionalRow(
                                            "Guardian's Name:",
                                            formatGuardianInfo(),
                                        )}
                                        {renderOptionalRow(
                                            "Guardian's Address:",
                                            formatGuardianAddress(),
                                        )}
                                        {renderOptionalRow(
                                            "Previous School Name & Address:",
                                            formatPreviousSchool(),
                                        )}
                                        {renderOptionalRow(
                                            "Previous School Acadmic Info:",
                                            formatPreviousSchoolMeta(),
                                        )}
                                        
                                        {renderOptionalRow(
                                            "Father's Mobile Number:",
                                            registration.father_phone,
                                        )}
                                        {renderOptionalRow(
                                            "Mother's Mobile Number:",
                                            registration.mother_phone,
                                        )}
                                        {renderOptionalRow(
                                            "Nearby Student Info:",
                                            registration.nearby_student_info,
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 text-center rounded-b border-t border-gray-200">
                    <p className="text-gray-600 mb-4 text-sm">
                        Please review all information carefully before confirming your
                        registration.
                    </p>
                    {registration.status !== "approved" ? (
                        <div className="mb-6">
                            <div className="bg-yellow-50 border border-yellow-300 rounded p-4 mb-4">
                                <p className="text-yellow-800 font-medium mb-1">
                                    ⚠️ Please review all information carefully before confirming
                                </p>
                                <p className="text-yellow-700 text-xs">
                                    Once confirmed, you cannot modify your registration details.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row justify-center gap-3">
                                <a
                                    href={`/registration/class-6/${registration.id}`}
                                    className="px-6 py-3 rounded font-medium transition-all duration-200 cursor-pointer bg-gray-600 hover:bg-gray-700 text-white! text-lg focus:outline-none flex items-center justify-center"
                                >
                                    <span className="mr-2">✏️</span>
                                    Edit registration
                                </a>
                                <button
                                    onClick={handleConfirmRegistration}
                                    disabled={confirming}
                                    className={`px-8 py-3 rounded font-medium transition-all duration-200 ${confirming
                                        ? "bg-gray-300 cursor-not-allowed text-gray-500"
                                        : "bg-green-600 hover:bg-green-700 text-white"
                                        } text-lg focus:outline-none flex items-center justify-center`}
                                >
                                    {confirming ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400 mr-3"></div>
                                            Confirming...
                                        </>
                                    ) : (
                                        <>
                                            <span className="mr-2">✓</span>
                                            Confirm registration
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-6">
                            <div className="bg-green-50 border border-green-300 rounded p-4">
                                <p className="text-green-800 font-medium">
                                    ✅ Your registration has been confirmed
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.6s ease-out forwards;
                }
                .wrap-break-word {
                    overflow-wrap: break-word;
                    word-wrap: break-word;
                    -ms-word-break: break-all;
                    word-break: break-word;
                }
            `}</style>
        </div>
    );
}

export default Class6RegConfirmation;
