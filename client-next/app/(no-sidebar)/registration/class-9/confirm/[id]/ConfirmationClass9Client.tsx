"use client";

import { useState } from "react";
import Link from "next/link";
import axios from "axios";
import toast from "react-hot-toast";
import Image from "next/image";
import { getFileUrl } from "@/lib/cdn";
import type { Class9RegistrationRecord } from "@school/shared-schemas";
import type { SchoolConfig } from "@/types";
import Class9DownloadPDF from "./Class9DownloadPDF";

type ConfirmationClass9ClientProps = {
    registration: Class9RegistrationRecord;
    schoolConfig: SchoolConfig;
    pdfUrl: string;
};

export default function ConfirmationClass9Client({
    registration,
    schoolConfig,
    pdfUrl,
}: ConfirmationClass9ClientProps) {
    const [confirming, setConfirming] = useState(false);
    const [isConfirmed, setIsConfirmed] = useState(false);

    const handleConfirmRegistration = async () => {
        if (!registration || registration.status === "approved") return;

        try {
            setConfirming(true);
            const response = await axios.put(
                `/api/reg/class-9/form/${registration.id}/status`,
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

    const formatGuardianInfo = () => {
        if (
            !registration.guardian_name &&
            !registration.guardian_phone &&
            !registration.guardian_relation &&
            !registration.guardian_nid
        ) {
            return "Not Applicable";
        }
        return (
            [
                registration.guardian_name
                    ? `Name: ${registration.guardian_name}`
                    : "",
                registration.guardian_relation
                    ? `Relation: ${registration.guardian_relation}`
                    : "",
                registration.guardian_phone
                    ? `Phone: ${registration.guardian_phone}`
                    : "",
                registration.guardian_nid ? `NID: ${registration.guardian_nid}` : "",
            ]
                .filter(Boolean)
                .join(", ") || "Not Applicable"
        );
    };

    const formatGuardianAddress = () => {
        const address = joinAddr(
            registration.guardian_village_road,
            registration.guardian_post_office,
            registration.guardian_post_code,
            registration.guardian_upazila,
            registration.guardian_district,
        );
        return address || "Not Applicable";
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
        return (
            [registration.father_phone ?? "", registration.mother_phone ?? ""]
                .filter(Boolean)
                .join(", ") || "No"
        );
    };

    const formatJSCInfo = () => {
        return (
            [
                registration.jsc_board ? `Board: ${registration.jsc_board}` : "",
                registration.jsc_passing_year
                    ? `Passing Year: ${registration.jsc_passing_year}`
                    : "",
                registration.jsc_roll_no
                    ? `Roll No- ${registration.jsc_roll_no}`
                    : "Roll No- N/A",
            ]
                .filter(Boolean)
                .join(", ") || null
        );
    };

    const formatScholarshipInfo = () => {
        const stipend = registration.upobritti
            ? `উপবৃত্তি: ${registration.upobritti === "Yes" ? "হ্যাঁ" : "না"}`
            : "";
        const brirti = String(registration.sorkari_brirti ?? "");
        const govScholarship = brirti
            ? `সরকারি বৃত্তি: ${
                  brirti === "No"
                      ? "না"
                      : brirti === "Talentpool"
                        ? "মেধাবৃত্তি"
                        : brirti === "General"
                          ? "সাধারণ বৃত্তি"
                          : brirti
              }`
            : "";

        return (
            [stipend, govScholarship].filter(Boolean).join(", ") || "Not specified"
        );
    };

    const formatMainAndFourthSubject = () => {
        return (
            [
                registration.group_class_nine ?? "",
                registration.main_subject ? `, ${registration.main_subject}` : "",
                registration.fourth_subject
                    ? `, 4th: ${registration.fourth_subject}`
                    : "",
            ]
                .map((s) => s.trim())
                .filter(Boolean)
                .join(" ") || null
        );
    };

    const formatPreviousSchool = () => {
        return (
            [
                registration.prev_school_name,
                registration.prev_school_upazila,
                registration.prev_school_district,
            ]
                .filter(Boolean)
                .join(", ") || null
        );
    };

    const photoPath =
        registration.photo_path ||
        (typeof registration.photo === "string" ? registration.photo : null);

    if (isConfirmed) {
        return (
            <Class9DownloadPDF
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
                        SSC Registration Confirmation
                    </h1>
                    <p className="mt-2 text-sm sm:text-base">
                        Please review your information and confirm if everything is correct.
                    </p>
                </div>

                {photoPath ? (
                    <div className="bg-white p-6 border-b border-gray-200 flex flex-col items-center">
                        <h3 className="text-base font-semibold mb-2 text-gray-700">
                            Student&apos;s Photo
                        </h3>
                        <Image
                            src={getFileUrl(photoPath)}
                            alt="Student Photo"
                            width={112}
                            height={142}
                            className="w-28 aspect-15/19 object-cover border-2 border-gray-300 rounded shadow-sm"
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                            }}
                        />
                    </div>
                ) : null}

                <div className="bg-white p-4 sm:p-8 space-y-8">
                    <div className="text-sm font-medium text-gray-800 border border-gray-200 rounded px-3 py-2 bg-gray-50 flex flex-wrap gap-x-4 gap-y-1">
                        <span>Batch: {registration.ssc_batch || "-"}</span>
                        <span>Section: {registration.section || "-"}</span>
                        <span>Roll No: {registration.roll || "-"}</span>
                        <span>Religion: {registration.religion || "-"}</span>
                        <span>JSC/JDC Regi. No: {registration.jsc_reg_no || "-"}</span>
                    </div>

                    <div className="border border-gray-200 bg-white rounded overflow-x-auto">
                        <table
                            className="w-full text-sm table-auto md:table-fixed"
                            style={{ minWidth: "600px" }}
                        >
                            <tbody>
                                {renderTableRow(
                                    "ছাত্রের নাম (JSC/JDC রেজিস্ট্রেশন অনুযায়ী):",
                                    registration.student_name_bn,
                                )}
                                {renderTableRow(
                                    "Student's Name:",
                                    registration.student_name_en?.toUpperCase(),
                                )}
                                {renderTableRow(
                                    "Birth Registration Number:",
                                    registration.birth_reg_no,
                                )}
                                {renderTableRow(
                                    "Date of Birth (According to JSC/JDC):",
                                    formatDateLong(registration.birth_date),
                                )}
                                {renderTableRow(
                                    "Email Address:",
                                    registration.email || "No",
                                )}
                                {renderTableRow("Mobile Numbers:", formatMobileNumbers())}
                                {renderTableRow(
                                    "পিতার নাম (JSC/JDC রেজিস্ট্রেশন অনুযায়ী):",
                                    registration.father_name_bn,
                                )}
                                {renderTableRow(
                                    "Father's Name:",
                                    registration.father_name_en?.toUpperCase(),
                                )}
                                {renderTableRow(
                                    "Father's National ID Number:",
                                    registration.father_nid,
                                )}
                                {renderTableRow(
                                    "মাতার নাম (JSC/JDC রেজিস্ট্রেশন অনুযায়ী):",
                                    registration.mother_name_bn,
                                )}
                                {renderTableRow(
                                    "Mother's Name:",
                                    registration.mother_name_en?.toUpperCase(),
                                )}
                                {renderTableRow(
                                    "Mother's National ID Number:",
                                    registration.mother_nid,
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
                                    "Previous School Name & Address:",
                                    formatPreviousSchool(),
                                )}
                                {renderTableRow("Information of JSC/JDC:", formatJSCInfo())}
                                {renderTableRow(
                                    "Main and 4th Subject:",
                                    formatMainAndFourthSubject(),
                                )}
                                {renderTableRow(
                                    "Scholarship Information:",
                                    formatScholarshipInfo(),
                                )}
                                {renderTableRow(
                                    "বাসার নিকটবর্তী নবম শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য:",
                                    registration.nearby_nine_student_info,
                                )}
                                {renderTableRow(
                                    "ছাত্রের ডাকনাম (বাংলায়):",
                                    registration.student_nick_name_bn,
                                )}
                                {renderTableRow(
                                    "৮ম শ্রেণির তথ্য:",
                                    `Section: ${registration.section_in_class_8}, Roll: ${registration.roll_in_class_8}`,
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
                                    href={`/registration/class-9/form/${registration.id}`}
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
