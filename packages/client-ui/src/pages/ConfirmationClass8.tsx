import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { getFileUrl } from "@/lib/backend";
import { useSchoolConfig } from "@/context/school";
import type { Class8RegistrationRecord } from "@school/shared-schemas";
import DownloadPDF from "@/components/DownloadPDF";

type ConfirmationClass8_Props = Partial<Class8RegistrationRecord> & { [key: string]: unknown };

function Class8RegConfirmation() {
    useEffect(() => {
        document.title = "Class Eight Registration Confirmation";
    }, []);
    const { id } = useParams<{ id: string }>();
    const [registration, setRegistration] =
        useState<ConfirmationClass8_Props | null>(null);
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
    
    const navigate = useNavigate();
    
    const fetchRegistrationData = async (regId: string) => {
        try {
            setLoading(true);
            const [response, regStatusRes] = await Promise.all([
                axios.get(`/api/reg/class-8/form/${regId}`),
                axios.get("/api/reg/class-8"),
            ]);

            const regOpen = regStatusRes.data?.data?.reg_open ?? true;

            if (response.data.success) {
                const data = response.data.data;
                if (!regOpen && data.status !== "approved") {
                    navigate("/", { replace: true });
                    return;
                }
                setRegistration(data);
                if (data.status === "approved") {
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
                `/api/reg/class-8/form/${registration.id}/status`,
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
                `/api/reg/class-8/form/${registration.id}/pdf`,
                { responseType: "blob" }
            ).catch(() => {
                // Fallback if PDF route not yet implemented or failing
                toast.error("PDF download not available yet");
                return null;
            });
            
            if (response) {
                const blob = new Blob([response.data], { type: "application/pdf" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Class8_Reg_${registration.student_name_en?.replace(/\s+/g, "_")}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            }
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
                        value ? "Yes" : "No"
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
            <DownloadPDF
                title1={"Registration Confirmed!"}
                title2={"Download Your Registration Form"}
                handleDownloadPDF={handleDownloadPDF}
                downloadingPDF={downloadingPDF}
            />
        );
    }

    return (
        <div className="w-full min-h-screen bg-gray-100 py-8 px-4">
            <div
                className={`max-w-4xl mx-auto transition-all duration-1000 ${isConfirmed ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"}`}
            >
                <div className="bg-gray-800 text-white p-6 sm:p-8 rounded-t">
                    <h1 className="text-2xl sm:text-3xl font-bold">
                        Registration Confirmation (Class 8)
                    </h1>
                    <p className="mt-2 text-sm sm:text-base">
                        Please review your information and confirm if everything is correct.
                    </p>
                </div>

                {registration.photo && (
                    <div className="bg-white p-6 border-b border-gray-200 flex flex-col items-center">
                        <h3 className="text-base font-semibold mb-2 text-gray-700">
                            Student's Photo
                        </h3>
                        <img
                            src={getFileUrl(registration.photo)}
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
                        {registration.class8_year ? (
                            <span>Year: {registration.class8_year}</span>
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
                                        <tr className="bg-gray-100 border-b border-gray-200">
                                            <td colSpan={2} className="py-2 px-4 font-bold text-gray-700">
                                                Personal Information
                                            </td>
                                        </tr>
                                        {renderOptionalRow("Section:", registration.section)}
                                        {renderOptionalRow("Roll:", registration.roll)}
                                        {renderOptionalRow("Religion:", registration.religion)}
                                        {renderOptionalRow("ছাত্রের নাম (বাংলায়):", registration.student_name_bn)}
                                        {renderOptionalRow(
                                            "Student's Name (in English):",
                                            registration.student_name_en?.toUpperCase()
                                        )}
                                        {renderOptionalRow("Birth Registration No:", registration.birth_reg_no)}
                                        {renderOptionalRow("Date of Birth:", formatDateLong(registration.birth_date))}
                                        {renderOptionalRow("Email:", registration.email)}
                                        {renderOptionalRow("পিতার নাম (বাংলায়):", registration.father_name_bn)}
                                        {renderOptionalRow(
                                            "Father's Name (in English):",
                                            registration.father_name_en?.toUpperCase()
                                        )}
                                        {renderOptionalRow("Father's NID:", registration.father_nid)}
                                        {renderOptionalRow("Father's Mobile Number:", registration.father_phone)}
                                        {renderOptionalRow("মাতার নাম (বাংলায়):", registration.mother_name_bn)}
                                        {renderOptionalRow(
                                            "Mother's Name (in English):",
                                            registration.mother_name_en?.toUpperCase()
                                        )}
                                        {renderOptionalRow("Mother's NID:", registration.mother_nid)}
                                        {renderOptionalRow("Mother's Mobile Number:", registration.mother_phone)}

                                        <tr className="bg-gray-100 border-b border-gray-200">
                                            <td colSpan={2} className="py-2 px-4 font-bold text-gray-700">
                                                Address Information
                                            </td>
                                        </tr>
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

                                        <tr className="bg-gray-100 border-b border-gray-200">
                                            <td colSpan={2} className="py-2 px-4 font-bold text-gray-700">
                                                Guardian Information
                                            </td>
                                        </tr>
                                        {renderOptionalRow("Guardian's Name:", registration.guardian_name)}
                                        {renderOptionalRow("Relationship with Guardian:", registration.guardian_relation)}
                                        {renderOptionalRow("Guardian's Mobile Number:", registration.guardian_phone)}
                                        {renderOptionalRow("Guardian's Address:", formatGuardianAddress())}

                                        <tr className="bg-gray-100 border-b border-gray-200">
                                            <td colSpan={2} className="py-2 px-4 font-bold text-gray-700">
                                                Previous School Information (Class 6)
                                            </td>
                                        </tr>
                                        {renderOptionalRow("Registration No:", registration.registration_no)}
                                        {renderOptionalRow("Class 6 Academic Session:", registration.class6_academic_session)}
                                        {renderOptionalRow("Name of Previous School:", registration.prev_school_name)}
                                        <tr className="bg-gray-100 border-b border-gray-200">
                                            <td colSpan={2} className="py-2 px-4 font-bold text-gray-700">
                                                Student Information Reference
                                            </td>
                                        </tr>
                                        {renderOptionalRow(
                                            "বাসার নিকটবর্তী অষ্টম শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য:",
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
                                <Link
                                    to={`/registration/class-8/form/${registration.id}`}
                                    className="px-6 py-3 rounded font-medium transition-all duration-200 cursor-pointer bg-gray-600 hover:bg-gray-700 text-white! text-lg focus:outline-none flex items-center justify-center"
                                >
                                    <span className="mr-2">✏️</span>
                                    Edit registration
                                </Link>
                                <button
                                    onClick={handleConfirmRegistration}
                                    disabled={confirming}
                                    className={`px-8 py-3 rounded font-medium transition-all duration-200 ${confirming
                                        ? "bg-gray-300 cursor-not-allowed text-gray-500"
                                        : "bg-green-600 hover:bg-green-700 text-white"
                                        } text-lg focus:outline-none flex items-center justify-center`}
                                >
                                    {confirming ? "Confirming..." : "Confirm registration"}
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
                .wrap-break-word {
                    overflow-wrap: break-word;
                    word-wrap: break-word;
                    word-break: break-word;
                }
            `}</style>
        </div>
    );
}

export default Class8RegConfirmation;
