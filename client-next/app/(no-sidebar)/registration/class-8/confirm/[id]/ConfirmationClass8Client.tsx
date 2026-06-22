"use client";

import { useState } from "react";
import Link from "next/link";
import axios from "axios";
import toast from "react-hot-toast";
import Image from "next/image";
import { getFileUrl } from "@/lib/cdn";
import type { Class8RegistrationRecord } from "@school/shared-schemas";
import type { SchoolConfig } from "@/types";
import Class8DownloadPDF from "./Class8DownloadPDF";

type ConfirmationClass8ClientProps = {
    registration: Class8RegistrationRecord;
    schoolConfig: SchoolConfig;
    pdfUrl: string;
};

export default function ConfirmationClass8Client({
    registration,
    schoolConfig,
    pdfUrl,
}: ConfirmationClass8ClientProps) {
    const [confirming, setConfirming] = useState(false);
    const [isConfirmed, setIsConfirmed] = useState(false);

    const handleConfirmRegistration = async () => {
        if (!registration || registration.status === "approved") return;

        try {
            setConfirming(true);
            const response = await axios.put(
                `/api/reg/class-8/form/${registration.id}/status`,
                { status: "approved" },
            );

            if (response.data.success) {
                toast.success("Registration confirmed successfully!");
                setIsConfirmed(true);
            } else {
                toast.error("Failed to confirm registration");
            }
        } catch {
            toast.error("Failed to confirm registration");
        } finally {
            setConfirming(false);
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

    const formatGuardianAddress = () => {
        const address = joinAddr(
            registration.guardian_village_road ?? "",
            registration.guardian_post_office ?? "",
            registration.guardian_post_code ?? "",
            registration.guardian_upazila ?? "",
            registration.guardian_district ?? "",
        );
        return address || null;
    };

    if (isConfirmed) {
        return (
            <Class8DownloadPDF
                registration={registration}
                schoolConfig={schoolConfig}
                pdfUrl={pdfUrl}
            />
        );
    }

    return (
        <div className="w-full min-h-screen bg-gray-100 py-8 px-4">
            <div className="max-w-4xl mx-auto">
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
                            Student&apos;s Photo
                        </h3>
                        <Image
                            src={getFileUrl(registration.photo)}
                            alt="Student Photo"
                            width={112}
                            height={142}
                            className="w-28 aspect-15/19 object-cover border-2 border-gray-300 rounded shadow-sm"
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

                    <div className="border border-gray-200 bg-white rounded overflow-x-auto">
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
                                {renderOptionalRow(
                                    "ছাত্রের নাম (বাংলায়):",
                                    registration.student_name_bn,
                                )}
                                {renderOptionalRow(
                                    "Student's Name (in English):",
                                    registration.student_name_en?.toUpperCase(),
                                )}
                                {renderOptionalRow(
                                    "Birth Registration No:",
                                    registration.birth_reg_no,
                                )}
                                {renderOptionalRow(
                                    "Date of Birth:",
                                    formatDateLong(registration.birth_date),
                                )}
                                {renderOptionalRow("Email:", registration.email)}
                                {renderOptionalRow(
                                    "পিতার নাম (বাংলায়):",
                                    registration.father_name_bn,
                                )}
                                {renderOptionalRow(
                                    "Father's Name (in English):",
                                    registration.father_name_en?.toUpperCase(),
                                )}
                                {renderOptionalRow("Father's NID:", registration.father_nid)}
                                {renderOptionalRow(
                                    "Father's Mobile Number:",
                                    registration.father_phone,
                                )}
                                {renderOptionalRow(
                                    "মাতার নাম (বাংলায়):",
                                    registration.mother_name_bn,
                                )}
                                {renderOptionalRow(
                                    "Mother's Name (in English):",
                                    registration.mother_name_en?.toUpperCase(),
                                )}
                                {renderOptionalRow("Mother's NID:", registration.mother_nid)}
                                {renderOptionalRow(
                                    "Mother's Mobile Number:",
                                    registration.mother_phone,
                                )}

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
                                {renderOptionalRow(
                                    "Guardian's Name:",
                                    registration.guardian_name,
                                )}
                                {renderOptionalRow(
                                    "Relationship with Guardian:",
                                    registration.guardian_relation,
                                )}
                                {renderOptionalRow(
                                    "Guardian's Mobile Number:",
                                    registration.guardian_phone,
                                )}
                                {renderOptionalRow(
                                    "Guardian's Address:",
                                    formatGuardianAddress(),
                                )}

                                <tr className="bg-gray-100 border-b border-gray-200">
                                    <td colSpan={2} className="py-2 px-4 font-bold text-gray-700">
                                        Previous School Information (Class Six)
                                    </td>
                                </tr>
                                {renderOptionalRow(
                                    "Registration No:",
                                    registration.registration_no,
                                )}
                                {renderOptionalRow(
                                    "Class Six Academic Session:",
                                    registration.class6_academic_session,
                                )}
                                {renderOptionalRow(
                                    "Name of Previous School:",
                                    registration.prev_school_name,
                                )}

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

                <div className="bg-white p-6 text-center rounded-b border-t border-gray-200">
                    <p className="text-gray-600 mb-4 text-sm">
                        Please review all information carefully before confirming your
                        registration.
                    </p>
                    {registration.status !== "approved" ? (
                        <div className="mb-6">
                            <div className="bg-yellow-50 border border-yellow-300 rounded p-4 mb-4">
                                <p className="text-yellow-800 font-medium mb-1">
                                    Please review all information carefully before confirming
                                </p>
                                <p className="text-yellow-700 text-xs">
                                    Once confirmed, you cannot modify your registration details.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row justify-center gap-3">
                                <Link
                                    href={`/registration/class-8/form/${registration.id}`}
                                    className="px-6 py-3 rounded font-medium transition-all duration-200 cursor-pointer bg-gray-600 hover:bg-gray-700 text-white! text-lg focus:outline-none flex items-center justify-center"
                                >
                                    Edit registration
                                </Link>
                                <button
                                    onClick={handleConfirmRegistration}
                                    disabled={confirming}
                                    className={`px-8 py-3 rounded font-medium transition-all duration-200 ${
                                        confirming
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
                                    Your registration has been confirmed
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
