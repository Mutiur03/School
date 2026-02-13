import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";


interface Class6RegistrationData {
    id: string;
    section: string;
    roll: string;
    class6_year: string;
    religion: string;
    student_name_bn: string;
    student_nick_name_bn: string;
    student_name_en: string;
    birth_reg_no: string;
    father_name_bn: string;
    father_name_en: string;
    father_nid: string;
    father_phone: string;
    mother_name_bn: string;
    mother_name_en: string;
    mother_nid: string;
    mother_phone: string;
    birth_date: string;
    blood_group: string;
    email: string;
    present_district: string;
    present_upazila: string;
    present_post_office: string;
    present_post_code: string;
    present_village_road: string;
    permanent_district: string;
    permanent_upazila: string;
    permanent_post_office: string;
    permanent_post_code: string;
    permanent_village_road: string;
    guardian_name: string;
    guardian_phone: string;
    guardian_relation: string;
    guardian_nid: string;
    guardian_district: string;
    guardian_upazila: string;
    guardian_post_office: string;
    guardian_post_code: string;
    guardian_village_road: string;
    prev_school_name: string;
    prev_school_district: string;
    prev_school_upazila: string;
    sorkari_brirti?: string;
    photo_path: string;
    status: string;
    submission_date: string;
}

function Class6RegConfirmation() {
    useEffect(() => {
        document.title = "Class 6 Registration Confirmation";
    }, []);
    const { id } = useParams<{ id: string }>();
    const [registration, setRegistration] = useState<Class6RegistrationData | null>(
        null,
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            fetchRegistrationData(id);
        }
    }, [id]);
    const host = import.meta.env.VITE_BACKEND_URL;
    const fetchRegistrationData = async (registrationId: string) => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/reg/class-6/form/${registrationId}`);

            if (response.data.success) {
                setRegistration(response.data.data);
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


    const renderTableRow = (
        label: string,
        value: string | number | boolean | null,
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
                        value ? "Yes" : "No"
                    ) : (
                        value.toString()
                    )}
                </div>
            </td>
        </tr>
    );

    const joinAddr = (
        village: string,
        postOffice: string,
        postCode: string,
        upazila: string,
        district: string,
    ) => {
        return (
            [
                village || "",
                postOffice
                    ? postCode
                        ? `${postOffice} (${postCode})`
                        : postOffice
                    : "",
                upazila || "",
                district || "",
            ]
                .filter(Boolean)
                .map((s) => s.toString().trim())
                .filter((s) => s.length > 0)
                .join(", ") || null
        );
    };

    const formatGuardianInfo = () => {
        if (
            !registration?.guardian_name &&
            !registration?.guardian_phone &&
            !registration?.guardian_relation &&
            !registration?.guardian_nid
        ) {
            return "Not Applicable";
        }
        return (
            [
                registration?.guardian_name
                    ? `Name: ${registration?.guardian_name}`
                    : "",
                registration?.guardian_relation
                    ? `Relation: ${registration?.guardian_relation}`
                    : "",
                registration?.guardian_phone
                    ? `Phone: ${registration?.guardian_phone}`
                    : "",
                registration?.guardian_nid ? `NID: ${registration?.guardian_nid}` : "",
            ]
                .filter(Boolean)
                .join(", ") || "Not Applicable"
        );
    };

    const formatGuardianAddress = () => {
        const address = joinAddr(
            registration?.guardian_village_road ?? "",
            registration?.guardian_post_office ?? "",
            registration?.guardian_post_code ?? "",
            registration?.guardian_upazila ?? "",
            registration?.guardian_district ?? "",
        );
        return address || "Not Applicable";
    };

    const formatScholarshipInfo = () => {
        const govScholarship = registration?.sorkari_brirti
            ? `সরকারি বৃত্তি: ${registration.sorkari_brirti}`
            : "";

        return (
            [govScholarship].filter(Boolean).join(", ") || "Not specified"
        );
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

    return (
        <div className="w-full min-h-screen bg-gray-100 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="bg-gray-800 text-white p-6 sm:p-8 rounded-t">
                    <h1 className="text-2xl sm:text-3xl font-bold">
                        Registration Details
                    </h1>
                    <p className="mt-2 text-sm sm:text-base">
                        Class Six Admission - {registration.class6_year}
                    </p>
                </div>

                {registration.photo_path && (
                    <div className="bg-white p-6 border-b border-gray-200 flex flex-col items-center">
                        <h3 className="text-base font-semibold mb-2 text-gray-700">
                            Student's Photo
                        </h3>
                        <img
                            src={`${host}/${registration.photo_path}`}
                            alt="Student Photo"
                            className="w-28 h-28 object-cover border-2 border-gray-300 rounded shadow-sm"
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                            }}
                        />
                    </div>
                )}

                <div className="bg-white p-4 sm:p-8 space-y-8">
                    <div className={`p-4 rounded-lg mb-6 ${registration.status === 'approved' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-yellow-50 border border-yellow-200 text-yellow-800'}`}>
                        <p className="font-bold text-lg flex items-center gap-2">
                            {registration.status === 'approved' ? '✅ Registration Approved' : '⏳ Application Pending'}
                        </p>
                        <p className="text-sm mt-1">
                            {registration.status === 'approved'
                                ? 'Your registration has been approved by the administration.'
                                : 'Your application has been submitted and is waiting for administrative approval.'}
                        </p>
                    </div>

                    <div className="text-sm font-medium text-gray-800 border border-gray-200 rounded px-3 py-2 bg-gray-50 flex flex-wrap gap-x-4 gap-y-1">
                        <span>Section: {registration.section || "-"}</span>
                        <span>Roll No: {registration.roll || "-"}</span>
                        <span>Religion: {registration.religion || "-"}</span>
                        <span>Blood Group: {registration.blood_group || "-"}</span>
                    </div>

                    <div className="grid gap-8">
                        <div className="border border-gray-200 bg-white rounded">
                            <div className="overflow-x-auto">
                                <table
                                    className="w-full text-sm table-auto md:table-fixed"
                                    style={{ minWidth: "600px" }}
                                >
                                    <tbody>
                                        {renderTableRow(
                                            "ছাত্রের নাম (বাংলা):",
                                            registration.student_name_bn,
                                        )}
                                        {renderTableRow(
                                            "Student's Name (English):",
                                            registration.student_name_en?.toUpperCase(),
                                        )}
                                        {renderTableRow(
                                            "Birth Registration Number:",
                                            registration.birth_reg_no,
                                        )}
                                        {renderTableRow(
                                            "Date of Birth:",
                                            registration.birth_date,
                                        )}
                                        {renderTableRow(
                                            "Email Address:",
                                            registration.email || "No",
                                        )}
                                        {renderTableRow(
                                            "Father's Name (English):",
                                            registration.father_name_en?.toUpperCase(),
                                        )}
                                        {renderTableRow(
                                            "Father's Name (Bangla):",
                                            registration.father_name_bn,
                                        )}
                                        {renderTableRow(
                                            "Father's NID:",
                                            registration.father_nid,
                                        )}
                                        {renderTableRow(
                                            "Father's Phone:",
                                            registration.father_phone,
                                        )}
                                        {renderTableRow(
                                            "Mother's Name (English):",
                                            registration.mother_name_en?.toUpperCase(),
                                        )}
                                        {renderTableRow(
                                            "Mother's Name (Bangla):",
                                            registration.mother_name_bn,
                                        )}
                                        {renderTableRow(
                                            "Mother's NID:",
                                            registration.mother_nid,
                                        )}
                                        {renderTableRow(
                                            "Mother's Phone:",
                                            registration.mother_phone,
                                        )}
                                        {renderTableRow(
                                            "Permanent Address:",
                                            joinAddr(
                                                registration.permanent_village_road,
                                                registration.permanent_post_office,
                                                registration.permanent_post_code,
                                                registration.permanent_upazila,
                                                registration.permanent_district,
                                            ),
                                        )}
                                        {renderTableRow(
                                            "Present Address:",
                                            joinAddr(
                                                registration.present_village_road,
                                                registration.present_post_office,
                                                registration.present_post_code,
                                                registration.present_upazila,
                                                registration.present_district,
                                            ),
                                        )}
                                        {renderTableRow("Guardian's Name:", formatGuardianInfo())}
                                        {renderTableRow(
                                            "Guardian's Address:",
                                            formatGuardianAddress(),
                                        )}
                                        {renderTableRow(
                                            "Previous School:",
                                            formatPreviousSchool(),
                                        )}
                                        {renderTableRow(
                                            "Scholarship Information:",
                                            formatScholarshipInfo(),
                                        )}
                                        {renderTableRow(
                                            "ছাত্রের ডাকনাম (বাংলায়):",
                                            registration.student_nick_name_bn,
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-white p-6 text-center rounded-b border-t border-gray-200">
                    <div className="flex flex-col sm:flex-row justify-center gap-3">
                        <button
                            onClick={() => window.print()}
                            className="px-6 py-3 rounded font-medium transition-all duration-200 bg-blue-600 hover:bg-blue-700 text-white text-lg focus:outline-none flex items-center justify-center"
                        >
                            🖨️ Print / Save as PDF
                        </button>
                        {registration.status !== "approved" && (
                            <button
                                onClick={() => {
                                    if (registration?.id) {
                                        window.location.href = `/registration/class-6/${registration.id}`;
                                    }
                                }}
                                className="px-6 py-3 rounded font-medium transition-all duration-200 bg-gray-600 hover:bg-gray-700 text-white text-lg focus:outline-none flex items-center justify-center"
                            >
                                ✏️ Edit Registration
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Class6RegConfirmation;
