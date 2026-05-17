"use client";
import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { getFileUrl } from "@/lib/cdn";
import { ConfirmationAdmission_Props } from "@/queries/admission-form.queries";
import type { SchoolConfig } from "@/types";
import DownloadPDF from "./AdmissionDownloadPDF";


function ConfirmationAdmissionClient({ admission, schoolConfig, pdf_url }: { admission: ConfirmationAdmission_Props, schoolConfig: SchoolConfig, pdf_url: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleConfirmadmission = async () => {
    if (!admission || admission.status === "approved") return;

    try {
      setConfirming(true);
      const response = await axios.put(
        `/api/admission/form/${admission.id}/approve`,
        {
          status: "approved",
        },
      );
      if (response.data.success) {
        toast.success("admission confirmed successfully!");
        setIsConfirmed(true);
      } else {
        toast.error("Failed to confirm admission");
      }
    } catch (error: unknown) {
      let message = "Failed to fetch admission data";
      if (axios.isAxiosError(error)) {
        message = error.response?.data?.message || message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message);
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

  const formatMobileNumbers = () => {
    const nums = [admission?.father_phone ?? "", admission?.mother_phone ?? ""]
      .filter(Boolean)
      .join(", ");
    return nums || null;
  };

  const formatPreviousSchool = () => {
    return (
      [
        admission?.prev_school_name,
        admission?.prev_school_upazila,
        admission?.prev_school_district,
      ]
        .filter(Boolean)
        .join(", ") || null
    );
  };

  const formatPreviousSchoolMeta = () => {
    if (!admission) return null;
    const parts: string[] = [];
    if (
      admission.section_in_prev_school &&
      String(admission.section_in_prev_school).trim() !== ""
    ) {
      parts.push(`Section: ${admission.section_in_prev_school}`);
    }
    if (
      admission.roll_in_prev_school &&
      String(admission.roll_in_prev_school).trim() !== ""
    ) {
      parts.push(`Roll: ${admission.roll_in_prev_school}`);
    }
    if (
      admission.prev_school_passing_year &&
      String(admission.prev_school_passing_year).trim() !== ""
    ) {
      parts.push(`Year: ${admission.prev_school_passing_year}`);
    }
    return parts.length > 0 ? parts.join(" / ") : null;
  };

  const formatQuota = (q?: string | null) => {
    if (!q) return null;
    const key = String(q).trim();
    const map: Record<string, string> = {
      "(GEN)": "সাধারণ (GEN)",
      "(DIS)": "বিশেষ চাহিদা সম্পন্ন ছাত্র (DIS)",
      "(FF)": "মুক্তিযোদ্ধার সন্তান (FF)",
      "(GOV)": "সরকারী প্রাথমিক বিদ্যালয়ের ছাত্র (GOV)",
      "(ME)": "শিক্ষা মন্ত্রণালয়ের কর্মকর্তা-কর্মচারী (ME)",
      "(SIB)": "সহোদর ভাই (SIB)",
      "(TWN)": "যমজ (TWN)",
      "(Mutual Transfer)": "পারস্পরিক বদলি (Mutual Transfer)",
      "(Govt. Transfer)": "সরকারি বদলি (Govt. Transfer)",
    };

    if (map[key]) return map[key];

    const normalized = key.replace(/\s+/g, " ").trim();
    if (map[normalized]) return map[normalized];

    const noParens = normalized.replace(/[()]/g, "").trim();
    const withParens = `(${noParens})`;
    if (map[withParens]) return map[withParens];

    return normalized;
  };

  const formatParentIncome = (p?: string | null) => {
    if (!p) return null;
    const key = String(p).trim();
    const map: Record<string, string> = {
      below_50000: "0 - 50,000",
      "50000_100000": "50,000 - 100,000",
      "100001_200000": "100,001 - 200,000",
      "200001_500000": "200,001 - 500,000",
      above_500000: "Above 500,000",
    };
    if (map[key]) return map[key];
    const fallback = key
      .replace(/_/g, " ")
      .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
    return fallback;
  };

  const formatGuardianInfo = () => {
    if (!admission) return null;
    if (
      !admission.guardian_name &&
      !admission.guardian_phone &&
      !admission.guardian_relation &&
      !admission.guardian_nid
    ) {
      return null;
    }
    return (
      [
        admission?.guardian_name ? `Name: ${admission?.guardian_name}` : "",
        admission?.guardian_relation
          ? `Relation: ${admission?.guardian_relation}`
          : "",
        admission?.guardian_phone ? `Phone: ${admission?.guardian_phone}` : "",
        admission?.guardian_nid ? `NID: ${admission?.guardian_nid}` : "",
      ]
        .filter(Boolean)
        .join(", ") || null
    );
  };

  const formatGuardianAddress = () => {
    if (!admission) return null;
    const address = joinAddr(
      admission?.guardian_village_road ?? "",
      admission?.guardian_post_office ?? "",
      admission?.guardian_post_code ?? "",
      admission?.guardian_upazila ?? "",
      admission?.guardian_district ?? "",
    );
    return address || null;
  };

  if (isConfirmed) {
    return <DownloadPDF admission={admission} schoolConfig={schoolConfig} pdf_url={pdf_url} />;
  }

  return (
    <div className="w-full min-h-screen bg-gray-100 py-8 px-4">
      <div
        className={`max-w-4xl mx-auto transition-all duration-1000 ${isConfirmed ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"}`}
      >
        <div className="bg-gray-800 text-white p-6 sm:p-8 rounded-t">
          <h1 className="text-2xl sm:text-3xl font-bold">
            Admission Confirmation
          </h1>
          <p className="mt-2 text-sm sm:text-base">
            Please review your information and confirm if everything is correct.
          </p>
        </div>

        {admission.photo_path && (
          <div className="bg-white p-6 border-b border-gray-200 flex flex-col items-center">
            <h3 className="text-base font-semibold mb-2 text-gray-700">
              Student's Photo
            </h3>
            <img
              src={`${getFileUrl(admission.photo_path)}`}
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
            {admission.admission_class ? (
              <span>Class: {admission.admission_class}</span>
            ) : null}
            {admission.list_type ? (
              <span>List Type: {admission.list_type}</span>
            ) : null}
            {admission.religion ? (
              <span>Religion: {admission.religion}</span>
            ) : null}
            {admission.admission_user_id ? (
              <span>User ID: {admission.admission_user_id}</span>
            ) : null}
            {admission.serial_no ? (
              <span>Serial No: {admission.serial_no}</span>
            ) : null}
            {admission.qouta ? (
              <span>Quota: {formatQuota(admission.qouta)}</span>
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
                      admission.student_name_bn,
                    )}
                    {renderOptionalRow(
                      "Student's Name:",
                      admission.student_name_en
                        ? admission.student_name_en.toUpperCase()
                        : undefined,
                    )}
                    {renderOptionalRow(
                      "Birth Registration Number:",
                      admission.birth_reg_no,
                    )}
                    {renderOptionalRow(
                      "Registration Number:",
                      admission.registration_no,
                    )}
                    {renderOptionalRow(
                      "Date of Birth:",
                      formatDateLong(admission.birth_date),
                    )}
                    {renderOptionalRow("Email Address:", admission.email)}
                    {renderOptionalRow(
                      "Mobile Numbers:",
                      formatMobileNumbers(),
                    )}
                    {renderOptionalRow("পিতার নাম:", admission.father_name_bn)}
                    {renderOptionalRow(
                      "Father's Name:",
                      admission.father_name_en
                        ? admission.father_name_en.toUpperCase()
                        : undefined,
                    )}
                    {renderOptionalRow(
                      "Father's National ID Number:",
                      admission.father_nid,
                    )}
                    {renderOptionalRow("মাতার নাম:", admission.mother_name_bn)}
                    {renderOptionalRow(
                      "Mother's Name:",
                      admission.mother_name_en
                        ? admission.mother_name_en.toUpperCase()
                        : undefined,
                    )}
                    {renderOptionalRow(
                      "Mother's National ID Number:",
                      admission.mother_nid,
                    )}
                    {renderOptionalRow(
                      "Permanent Address:",
                      joinAddr(
                        admission.permanent_village_road,
                        admission.permanent_post_office,
                        admission.permanent_post_code,
                        admission.permanent_upazila,
                        admission.permanent_district,
                      ),
                    )}
                    {renderOptionalRow(
                      "Present Address:",
                      joinAddr(
                        admission.present_village_road,
                        admission.present_post_office,
                        admission.present_post_code,
                        admission.present_upazila,
                        admission.present_district,
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
                      admission.father_phone,
                    )}
                    {renderOptionalRow(
                      "Mother's Mobile Number:",
                      admission.mother_phone,
                    )}
                    {renderOptionalRow(
                      "Whatsapp Number:",
                      admission.whatsapp_number,
                    )}
                    {renderOptionalRow("Blood Group:", admission.blood_group)}
                    {renderOptionalRow(
                      "Father's Profession:",
                      admission.father_profession,
                    )}
                    {renderOptionalRow(
                      "Mother's Profession:",
                      admission.mother_profession,
                    )}
                    {renderOptionalRow(
                      "Parent's Annual Income:",
                      formatParentIncome(admission.parent_income),
                    )}
                    {renderOptionalRow(
                      "Student Nickname (BN):",
                      admission.student_nick_name_bn,
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
            admission.
          </p>
          {admission.status !== "approved" ? (
            <div className="mb-6">
              <div className="bg-yellow-50 border border-yellow-300 rounded p-4 mb-4">
                <p className="text-yellow-800 font-medium mb-1">
                  ⚠️ Please review all information carefully before confirming
                </p>
                <p className="text-yellow-700 text-xs">
                  Once confirmed, you cannot modify your admission details.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <button
                  onClick={() => {
                    if (admission?.id) {
                      window.location.href = `/admission/form/${admission.id}`;
                    }
                  }}
                  className="px-6 py-3 rounded font-medium transition-all duration-200 bg-gray-600 hover:bg-gray-700 text-white text-lg focus:outline-none flex items-center justify-center"
                >
                  <span className="mr-2">✏️</span>
                  Edit admission
                </button>
                <button
                  onClick={handleConfirmadmission}
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
                      Confirm admission
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <div className="bg-green-50 border border-green-300 rounded p-4">
                <p className="text-green-800 font-medium">
                  ✅ Your admission has been confirmed
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(20px);}
                    to { opacity: 1; transform: translateY(0);}
                }
                .animate-fade-in {
                    animation: fade-in 0.5s ease-out;
                }
            `}</style>
    </div>
  );
}

export default ConfirmationAdmissionClient
